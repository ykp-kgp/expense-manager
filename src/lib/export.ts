import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { format } from 'date-fns';
import { listExpenses } from './queries';
import { getRawDb } from '@/db';

function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function exportExpensesCsv(): Promise<string> {
  const rows = await listExpenses({});
  const header = ['Date', 'Amount', 'Category', 'Payment Method', 'Note'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [r.date, r.amount, r.categoryName, r.paymentMethodName, r.note]
        .map(csvEscape)
        .join(',')
    );
  }
  const filename = `expenses-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`;
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, lines.join('\n'), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return path;
}

export async function exportExpensesJson(): Promise<string> {
  const rows = await listExpenses({});
  const filename = `expenses-${format(new Date(), 'yyyyMMdd-HHmm')}.json`;
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(rows, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return path;
}

export async function shareFile(path: string, mime = 'text/plain') {
  const ok = await Sharing.isAvailableAsync();
  if (!ok) throw new Error('Sharing not available on this device');
  await Sharing.shareAsync(path, { mimeType: mime, dialogTitle: 'Share export' });
}

// ===== Local import / restore =====

export type ImportMode = 'merge' | 'replace';

export type ImportResult = {
  imported: number;
  skipped: number;
  mode: ImportMode;
};

type RawImportExpense = {
  amount?: number | string;
  date?: string;
  note?: string | null;
  categoryId?: number | string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  paymentMethodId?: number | string;
  paymentMethodName?: string;
  paymentMethodIcon?: string;
  recurringId?: number | null;
  createdAt?: string | number;
  updatedAt?: string | number;
};

/**
 * Opens the system file picker and returns the file's text contents,
 * or null if the user cancelled.
 */
export async function pickJsonFile(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.length) return null;
  return FileSystem.readAsStringAsync(res.assets[0].uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

function toTimestamp(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Imports expenses from a JSON string previously produced by
 * "Export to JSON" or an encrypted Drive backup (after decryption).
 *
 * Categories and payment methods are matched by name (case-insensitive)
 * and created when missing, so imports survive across installs where IDs
 * differ. Receipt images are not part of the export and are not restored.
 */
export async function importExpensesFromJson(
  raw: string,
  mode: ImportMode
): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('That file is not valid JSON.');
  }

  const expenses: RawImportExpense[] = Array.isArray(parsed)
    ? (parsed as RawImportExpense[])
    : Array.isArray((parsed as { expenses?: unknown })?.expenses)
      ? ((parsed as { expenses: RawImportExpense[] }).expenses)
      : [];

  if (expenses.length === 0) {
    throw new Error('No expenses found in this file.');
  }

  const sqlite = getRawDb();
  let imported = 0;
  let skipped = 0;

  await sqlite.withTransactionAsync(async () => {
    const catRows = await sqlite.getAllAsync<{ id: number; name: string }>(
      'SELECT id, name FROM categories'
    );
    const pmRows = await sqlite.getAllAsync<{ id: number; name: string }>(
      'SELECT id, name FROM payment_methods'
    );
    const catByName = new Map(catRows.map((r) => [r.name.toLowerCase(), r.id]));
    const pmByName = new Map(pmRows.map((r) => [r.name.toLowerCase(), r.id]));
    const catIds = new Set(catRows.map((r) => r.id));
    const pmIds = new Set(pmRows.map((r) => r.id));
    const fallbackCat = catRows[0]?.id;
    const fallbackPm = pmRows[0]?.id;
    let nextCatSort = catRows.length;
    let nextPmSort = pmRows.length;

    const resolveCategory = async (e: RawImportExpense): Promise<number | null> => {
      const name = (e.categoryName ?? '').trim();
      if (name) {
        const key = name.toLowerCase();
        const existing = catByName.get(key);
        if (existing != null) return existing;
        const res = await sqlite.runAsync(
          'INSERT INTO categories (name, icon, color, sort_order) VALUES (?, ?, ?, ?)',
          [name, e.categoryIcon || 'tag', e.categoryColor || '#546E7A', nextCatSort++]
        );
        catByName.set(key, res.lastInsertRowId);
        return res.lastInsertRowId;
      }
      const id = e.categoryId != null ? Number(e.categoryId) : NaN;
      if (!Number.isNaN(id) && catIds.has(id)) return id;
      return fallbackCat ?? null;
    };

    const resolvePaymentMethod = async (e: RawImportExpense): Promise<number | null> => {
      const name = (e.paymentMethodName ?? '').trim();
      if (name) {
        const key = name.toLowerCase();
        const existing = pmByName.get(key);
        if (existing != null) return existing;
        const res = await sqlite.runAsync(
          'INSERT INTO payment_methods (name, icon, sort_order) VALUES (?, ?, ?)',
          [name, e.paymentMethodIcon || 'cash', nextPmSort++]
        );
        pmByName.set(key, res.lastInsertRowId);
        return res.lastInsertRowId;
      }
      const id = e.paymentMethodId != null ? Number(e.paymentMethodId) : NaN;
      if (!Number.isNaN(id) && pmIds.has(id)) return id;
      return fallbackPm ?? null;
    };

    if (mode === 'replace') {
      await sqlite.runAsync('DELETE FROM expenses');
    }

    for (const e of expenses) {
      const amount = Number(e.amount);
      const date = typeof e.date === 'string' ? e.date.slice(0, 10) : '';
      if (!Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        skipped++;
        continue;
      }
      const categoryId = await resolveCategory(e);
      const paymentMethodId = await resolvePaymentMethod(e);
      if (categoryId == null || paymentMethodId == null) {
        skipped++;
        continue;
      }
      const created = toTimestamp(e.createdAt, Date.now());
      const updated = toTimestamp(e.updatedAt, created);
      await sqlite.runAsync(
        `INSERT INTO expenses
          (amount, category_id, payment_method_id, date, note, attachment_path, recurring_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          amount,
          categoryId,
          paymentMethodId,
          date,
          (e.note as string) ?? null,
          null,
          null,
          created,
          updated,
        ]
      );
      imported++;
    }
  });

  return { imported, skipped, mode };
}
