import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import {
  listCategories,
  listPaymentMethods,
  listAllExpenses,
  listAllBudgets,
  listAllRecurringRules,
} from './queries';
import { encryptString, decryptString } from './crypto';
import { verifyPin, getPinForBackup } from './auth';
import { getRawDb } from '@/db';

const DRIVE_TOKEN_KEY = 'em.drive.refresh_token';
const DRIVE_LAST_BACKUP_KEY = 'em.drive.last_backup_at';
const SCOPES = ['https://www.googleapis.com/auth/drive.appdata'];
const BACKUP_FILENAME = 'expense-manager.backup.json';

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

function getClientId(): string | null {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  return (extra.googleAndroidClientId as string) ?? null;
}

export async function isDriveConnected(): Promise<boolean> {
  return !!(await SecureStore.getItemAsync(DRIVE_TOKEN_KEY));
}

export async function getLastBackupAt(): Promise<string | null> {
  return SecureStore.getItemAsync(DRIVE_LAST_BACKUP_KEY);
}

export async function disconnectDrive() {
  const token = await SecureStore.getItemAsync(DRIVE_TOKEN_KEY);
  if (token) {
    try {
      // Send the token in the request body, not the URL, so it is not captured
      // in proxy/server logs or browser history.
      await fetch(discovery.revocationEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }).toString(),
      });
    } catch {
      // ignore
    }
  }
  await SecureStore.deleteItemAsync(DRIVE_TOKEN_KEY);
  await SecureStore.deleteItemAsync(DRIVE_LAST_BACKUP_KEY);
}

async function obtainAccessToken(): Promise<string> {
  const refreshToken = await SecureStore.getItemAsync(DRIVE_TOKEN_KEY);
  const clientId = getClientId();
  if (!clientId) throw new Error('Google client ID not configured.');
  if (!refreshToken) throw new Error('Drive not connected.');

  const body = new URLSearchParams({
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch(discovery.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Drive token refresh failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export async function connectDrive(): Promise<boolean> {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error(
      'Google OAuth client ID is not configured. Add `extra.googleAndroidClientId` in app.json.'
    );
  }
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'expensemanager' });
  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: SCOPES,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: { access_type: 'offline', prompt: 'consent' },
  });
  const result = await request.promptAsync(discovery);
  if (result.type !== 'success' || !result.params.code) return false;

  const token = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code: result.params.code,
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier ?? '' },
    },
    discovery
  );
  if (!token.refreshToken) {
    throw new Error('Google did not return a refresh token. Try reconnecting.');
  }
  await SecureStore.setItemAsync(DRIVE_TOKEN_KEY, token.refreshToken);
  return true;
}

async function findBackupFileId(accessToken: string): Promise<string | null> {
  const url =
    'https://www.googleapis.com/drive/v3/files' +
    `?spaces=appDataFolder&q=${encodeURIComponent(`name='${BACKUP_FILENAME}'`)}` +
    '&fields=files(id,name,modifiedTime)';
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
  const json = (await res.json()) as { files: Array<{ id: string }> };
  return json.files[0]?.id ?? null;
}

/**
 * Current backup schema. v2 captures the full dataset (categories, payment
 * methods, expenses, budgets, recurring rules) with their primary keys so
 * foreign-key references survive a restore. v1 backups held only expenses and
 * are still readable on restore.
 */
const BACKUP_VERSION = 2;

async function buildBackupPayload(): Promise<string> {
  const [categories, paymentMethods, expenses, budgets, recurringRules] =
    await Promise.all([
      listCategories(),
      listPaymentMethods(),
      listAllExpenses(),
      listAllBudgets(),
      listAllRecurringRules(),
    ]);
  return JSON.stringify({
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    categories,
    paymentMethods,
    expenses,
    budgets,
    recurringRules,
  });
}

export async function backupNow(pin: string): Promise<void> {
  const ok = await verifyPin(pin);
  if (!ok) throw new Error('Incorrect PIN.');
  const stored = await getPinForBackup();
  if (!stored) throw new Error('No PIN is set on this device.');
  const accessToken = await obtainAccessToken();

  const plain = await buildBackupPayload();
  const encrypted = encryptString(plain, pin, stored.salt);

  const existingId = await findBackupFileId(accessToken);
  const metadata = { name: BACKUP_FILENAME, parents: existingId ? undefined : ['appDataFolder'] };
  const boundary = '-------expense-manager-' + Date.now();
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    encrypted +
    `\r\n--${boundary}--`;

  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const res = await fetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Drive upload failed: ${res.status} ${txt}`);
  }
  await SecureStore.setItemAsync(DRIVE_LAST_BACKUP_KEY, new Date().toISOString());
}

export type BackupPreview = {
  exportedAt: string;
  expenseCount: number;
};

export async function restoreFromDrive(pin: string): Promise<BackupPreview> {
  const accessToken = await obtainAccessToken();
  const fileId = await findBackupFileId(accessToken);
  if (!fileId) throw new Error('No backup found in your Drive.');
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  const encrypted = await res.text();

  // decryptString throws DecryptionError on a wrong PIN or a tampered file,
  // so we never reach the destructive DB write with unauthenticated data.
  const plain = decryptString(encrypted, pin);

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(plain) as Record<string, unknown>;
  } catch {
    throw new Error('Backup contents are not valid. Nothing was changed.');
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.expenses)) {
    throw new Error('Backup does not contain any expenses. Nothing was changed.');
  }

  // Everything below validates the ENTIRE payload before a single row is
  // written, so a malformed backup can never leave the database half-wiped.
  const exportedAt =
    typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString();

  if (data.version === BACKUP_VERSION) {
    const parsed = parseV2(data);
    await applyV2Restore(parsed);
    return { exportedAt, expenseCount: parsed.expenses.length };
  }

  // Legacy v1: expenses only. Categories/payment methods are assumed to match
  // the IDs already seeded on this device.
  const expenses = parseExpenses(data.expenses as unknown[]);
  const sqlite = getRawDb();
  await sqlite.withTransactionAsync(async () => {
    await sqlite.runAsync('DELETE FROM expenses');
    for (const e of expenses) insertExpense(sqlite, e);
  });
  return { exportedAt, expenseCount: expenses.length };
}

// ===== Restore validation & apply =====

type CleanCategory = { id: number; name: string; icon: string; color: string; sortOrder: number };
type CleanPaymentMethod = { id: number; name: string; icon: string; sortOrder: number };
type CleanExpense = {
  id: number | null;
  amount: number;
  categoryId: number;
  paymentMethodId: number;
  date: string;
  note: string | null;
  attachmentPath: string | null;
  recurringId: number | null;
  createdAt: number;
  updatedAt: number;
};
type CleanBudget = { id: number | null; categoryId: number | null; month: string; amount: number };
type CleanRecurringRule = {
  id: number | null;
  amount: number;
  categoryId: number;
  paymentMethodId: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  intervalCount: number;
  startDate: string;
  endDate: string | null;
  nextRunDate: string;
  note: string | null;
  active: number;
  createdAt: number;
};

type ParsedV2 = {
  categories: CleanCategory[];
  paymentMethods: CleanPaymentMethod[];
  expenses: CleanExpense[];
  budgets: CleanBudget[];
  recurringRules: CleanRecurringRule[];
};

function asRecord(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    throw new Error('Backup is malformed. Nothing was changed.');
  }
  return v as Record<string, unknown>;
}

function requireArray(v: unknown, name: string): unknown[] {
  if (!Array.isArray(v)) {
    throw new Error(`Backup is missing "${name}". Nothing was changed.`);
  }
  return v;
}

function reqInt(v: unknown, label: string): number {
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error(`${label} is invalid. Nothing was changed.`);
  return n;
}

function reqStr(v: unknown, label: string): string {
  if (typeof v !== 'string') throw new Error(`${label} is invalid. Nothing was changed.`);
  return v;
}

function optStr(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function toMs(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = new Date(v).getTime();
    if (Number.isFinite(t)) return t;
  }
  return fallback;
}

const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'] as const;

function parseExpenses(raw: unknown[]): CleanExpense[] {
  return raw.map((item, i) => {
    const e = asRecord(item);
    const amount = Number(e.amount);
    const categoryId = Number(e.categoryId);
    const paymentMethodId = Number(e.paymentMethodId);
    if (!Number.isFinite(amount) || !Number.isInteger(categoryId) || !Number.isInteger(paymentMethodId)) {
      throw new Error(`Backup expense ${i + 1} is malformed. Nothing was changed.`);
    }
    const createdAt = toMs(e.createdAt, Date.now());
    return {
      id: Number.isInteger(Number(e.id)) ? Number(e.id) : null,
      amount,
      categoryId,
      paymentMethodId,
      date: typeof e.date === 'string' ? e.date : String(e.date ?? ''),
      note: optStr(e.note),
      attachmentPath: optStr(e.attachmentPath),
      recurringId: Number.isInteger(Number(e.recurringId)) ? Number(e.recurringId) : null,
      createdAt,
      updatedAt: toMs(e.updatedAt, createdAt),
    };
  });
}

function parseV2(data: Record<string, unknown>): ParsedV2 {
  const categories = requireArray(data.categories, 'categories').map((item, i) => {
    const c = asRecord(item);
    return {
      id: reqInt(c.id, `Category ${i + 1} id`),
      name: reqStr(c.name, `Category ${i + 1} name`),
      icon: reqStr(c.icon, `Category ${i + 1} icon`),
      color: reqStr(c.color, `Category ${i + 1} color`),
      sortOrder: Number.isInteger(Number(c.sortOrder)) ? Number(c.sortOrder) : 0,
    };
  });

  const paymentMethods = requireArray(data.paymentMethods, 'paymentMethods').map((item, i) => {
    const p = asRecord(item);
    return {
      id: reqInt(p.id, `Payment method ${i + 1} id`),
      name: reqStr(p.name, `Payment method ${i + 1} name`),
      icon: reqStr(p.icon, `Payment method ${i + 1} icon`),
      sortOrder: Number.isInteger(Number(p.sortOrder)) ? Number(p.sortOrder) : 0,
    };
  });

  const expenses = parseExpenses(requireArray(data.expenses, 'expenses'));

  const budgets = requireArray(data.budgets, 'budgets').map((item, i) => {
    const b = asRecord(item);
    const amount = Number(b.amount);
    if (!Number.isFinite(amount)) throw new Error(`Budget ${i + 1} is malformed. Nothing was changed.`);
    return {
      id: Number.isInteger(Number(b.id)) ? Number(b.id) : null,
      categoryId: Number.isInteger(Number(b.categoryId)) ? Number(b.categoryId) : null,
      month: reqStr(b.month, `Budget ${i + 1} month`),
      amount,
    };
  });

  const recurringRules = requireArray(data.recurringRules, 'recurringRules').map((item, i) => {
    const r = asRecord(item);
    const amount = Number(r.amount);
    const frequency = String(r.frequency) as CleanRecurringRule['frequency'];
    if (!Number.isFinite(amount) || !FREQUENCIES.includes(frequency)) {
      throw new Error(`Recurring rule ${i + 1} is malformed. Nothing was changed.`);
    }
    return {
      id: Number.isInteger(Number(r.id)) ? Number(r.id) : null,
      amount,
      categoryId: reqInt(r.categoryId, `Recurring rule ${i + 1} category`),
      paymentMethodId: reqInt(r.paymentMethodId, `Recurring rule ${i + 1} payment method`),
      frequency,
      intervalCount: Number.isInteger(Number(r.intervalCount)) ? Number(r.intervalCount) : 1,
      startDate: reqStr(r.startDate, `Recurring rule ${i + 1} start date`),
      endDate: optStr(r.endDate),
      nextRunDate: reqStr(r.nextRunDate, `Recurring rule ${i + 1} next run date`),
      note: optStr(r.note),
      active: r.active ? 1 : 0,
      createdAt: toMs(r.createdAt, Date.now()),
    };
  });

  return { categories, paymentMethods, expenses, budgets, recurringRules };
}

function insertExpense(sqlite: ReturnType<typeof getRawDb>, e: CleanExpense) {
  const cols = e.id != null ? 'id, ' : '';
  const slots = e.id != null ? '?, ' : '';
  const head = e.id != null ? [e.id] : [];
  return sqlite.runAsync(
    `INSERT INTO expenses
      (${cols}amount, category_id, payment_method_id, date, note, attachment_path, recurring_id, created_at, updated_at)
     VALUES (${slots}?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...head, e.amount, e.categoryId, e.paymentMethodId, e.date, e.note, e.attachmentPath, e.recurringId, e.createdAt, e.updatedAt]
  );
}

/**
 * Wipes and reinserts every table in one transaction, preserving primary keys
 * so foreign-key references stay intact. Children are deleted before parents
 * (and parents inserted before children) to satisfy foreign_keys = ON.
 */
async function applyV2Restore(data: ParsedV2): Promise<void> {
  const sqlite = getRawDb();
  await sqlite.withTransactionAsync(async () => {
    await sqlite.runAsync('DELETE FROM expenses');
    await sqlite.runAsync('DELETE FROM budgets');
    await sqlite.runAsync('DELETE FROM recurring_rules');
    await sqlite.runAsync('DELETE FROM categories');
    await sqlite.runAsync('DELETE FROM payment_methods');

    for (const c of data.categories) {
      await sqlite.runAsync(
        'INSERT INTO categories (id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)',
        [c.id, c.name, c.icon, c.color, c.sortOrder]
      );
    }
    for (const p of data.paymentMethods) {
      await sqlite.runAsync(
        'INSERT INTO payment_methods (id, name, icon, sort_order) VALUES (?, ?, ?, ?)',
        [p.id, p.name, p.icon, p.sortOrder]
      );
    }
    for (const r of data.recurringRules) {
      await sqlite.runAsync(
        `INSERT INTO recurring_rules
          (id, amount, category_id, payment_method_id, frequency, interval_count,
           start_date, end_date, next_run_date, note, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.amount, r.categoryId, r.paymentMethodId, r.frequency, r.intervalCount, r.startDate, r.endDate, r.nextRunDate, r.note, r.active, r.createdAt]
      );
    }
    for (const b of data.budgets) {
      await sqlite.runAsync(
        'INSERT INTO budgets (id, category_id, month, amount) VALUES (?, ?, ?, ?)',
        [b.id, b.categoryId, b.month, b.amount]
      );
    }
    for (const e of data.expenses) await insertExpense(sqlite, e);
  });
}
