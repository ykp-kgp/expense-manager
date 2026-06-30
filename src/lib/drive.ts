import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { listExpenses } from './queries';
import { importExpensesFromJson } from './export';
import { encryptString, decryptString } from './crypto';
import { verifyPin } from './auth';

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
  const iosId = (extra.googleIosClientId as string) ?? null;
  const androidId = (extra.googleAndroidClientId as string) ?? null;
  const id = Platform.OS === 'ios' ? iosId ?? androidId : androidId;
  return id || null;
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
      await fetch(`${discovery.revocationEndpoint}?token=${token}`, { method: 'POST' });
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

async function buildBackupPayload(): Promise<string> {
  const expenses = await listExpenses({});
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    expenses,
  });
}

export async function backupNow(pin: string): Promise<void> {
  const ok = await verifyPin(pin);
  if (!ok) throw new Error('Incorrect PIN.');
  const salt = (await SecureStore.getItemAsync('em.pin_salt'))!;
  const accessToken = await obtainAccessToken();

  const plain = await buildBackupPayload();
  const encrypted = encryptString(plain, pin, salt);

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
  // Throws a clear "Incorrect PIN or corrupted backup" if the PIN is wrong.
  const plain = decryptString(encrypted, pin);

  let exportedAt = '';
  try {
    exportedAt = (JSON.parse(plain) as { exportedAt?: string }).exportedAt ?? '';
  } catch {
    throw new Error('Backup file is not in the expected format.');
  }

  // Reuse the name-matching importer so a restore works across installs where
  // category / payment-method IDs differ (the previous ID-based insert failed
  // foreign-key checks on a fresh device).
  const result = await importExpensesFromJson(plain, 'replace');

  return {
    exportedAt,
    expenseCount: result.imported,
  };
}
