import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { generateSalt, hashPin } from './crypto';

const KEY_PIN_HASH = 'em.pin_hash';
const KEY_PIN_SALT = 'em.pin_salt';
const KEY_PIN_LEN = 'em.pin_len';
const KEY_BIO_ENABLED = 'em.bio_enabled';
const KEY_FAIL_COUNT = 'em.pin_fail_count';
const KEY_LOCK_UNTIL = 'em.pin_lock_until';

/** Attempts allowed before lockouts begin. */
const FREE_ATTEMPTS = 5;
/**
 * Lockout duration (ms) applied on the Nth consecutive failure, indexed from
 * the first throttled failure. Escalates, then caps at the final value.
 */
const LOCKOUT_LADDER_MS = [
  30_000, // 30s
  60_000, // 1m
  5 * 60_000, // 5m
  15 * 60_000, // 15m
  30 * 60_000, // 30m
  60 * 60_000, // 60m (cap)
];

export async function hasPin(): Promise<boolean> {
  const hash = await SecureStore.getItemAsync(KEY_PIN_HASH);
  return !!hash;
}

export async function setPin(pin: string): Promise<void> {
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error('PIN must be 4-6 digits.');
  }
  const salt = await generateSalt(16);
  // Yield so navigation/UI can paint before the synchronous PBKDF2 stretch.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  const hash = hashPin(pin, salt);
  await Promise.all([
    SecureStore.setItemAsync(KEY_PIN_SALT, salt),
    SecureStore.setItemAsync(KEY_PIN_HASH, hash),
    // Store the length so the unlock screen can count each complete attempt for
    // lockout — otherwise a shorter PIN could be brute-forced without tripping it.
    SecureStore.setItemAsync(KEY_PIN_LEN, String(pin.length)),
  ]);
  await resetLockout();
}

export async function getPinLength(): Promise<number | null> {
  const raw = await SecureStore.getItemAsync(KEY_PIN_LEN);
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isInteger(n) && n >= 4 && n <= 6 ? n : null;
}

/** Records the PIN length for PINs created before length tracking existed. */
export async function backfillPinLength(length: number): Promise<void> {
  if (length < 4 || length > 6) return;
  const existing = await SecureStore.getItemAsync(KEY_PIN_LEN);
  if (!existing) await SecureStore.setItemAsync(KEY_PIN_LEN, String(length));
}

export async function verifyPin(pin: string): Promise<boolean> {
  const salt = await SecureStore.getItemAsync(KEY_PIN_SALT);
  const stored = await SecureStore.getItemAsync(KEY_PIN_HASH);
  if (!salt || !stored) return false;
  const computed = hashPin(pin, salt);
  return timingSafeEqual(computed, stored);
}

export type LockStatus = {
  /** True while the app is throttled and PIN entry must be blocked. */
  locked: boolean;
  /** Epoch ms when the lock lifts, or null when not locked. */
  lockedUntil: number | null;
  /** Consecutive failed attempts recorded so far. */
  failCount: number;
  /** Attempts remaining before the next lockout kicks in. */
  attemptsRemaining: number;
};

export type PinVerifyResult = LockStatus & { ok: boolean };

async function readLockState(): Promise<{ failCount: number; lockedUntil: number }> {
  const [rawCount, rawUntil] = await Promise.all([
    SecureStore.getItemAsync(KEY_FAIL_COUNT),
    SecureStore.getItemAsync(KEY_LOCK_UNTIL),
  ]);
  return {
    failCount: rawCount ? parseInt(rawCount, 10) || 0 : 0,
    lockedUntil: rawUntil ? parseInt(rawUntil, 10) || 0 : 0,
  };
}

function toStatus(failCount: number, lockedUntil: number): LockStatus {
  const now = Date.now();
  const locked = lockedUntil > now;
  return {
    locked,
    lockedUntil: locked ? lockedUntil : null,
    failCount,
    attemptsRemaining: Math.max(0, FREE_ATTEMPTS - failCount),
  };
}

export async function getLockStatus(): Promise<LockStatus> {
  const { failCount, lockedUntil } = await readLockState();
  return toStatus(failCount, lockedUntil);
}

/** Clears the failed-attempt counter and any active lockout. */
export async function resetLockout(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_FAIL_COUNT),
    SecureStore.deleteItemAsync(KEY_LOCK_UNTIL),
  ]);
}

/**
 * Verifies a PIN while enforcing an escalating lockout. Successful unlocks
 * (including elsewhere, e.g. biometrics) should call {@link resetLockout}.
 */
export async function verifyPinWithLockout(pin: string): Promise<PinVerifyResult> {
  const state = await readLockState();
  const current = toStatus(state.failCount, state.lockedUntil);
  if (current.locked) {
    return { ...current, ok: false };
  }

  const ok = await verifyPin(pin);
  if (ok) {
    await resetLockout();
    return { ok: true, locked: false, lockedUntil: null, failCount: 0, attemptsRemaining: FREE_ATTEMPTS };
  }

  const failCount = state.failCount + 1;
  const throttledIndex = failCount - FREE_ATTEMPTS; // 1-based once past the free tier
  let lockedUntil = 0;
  if (throttledIndex >= 1) {
    const ladderPos = Math.min(throttledIndex - 1, LOCKOUT_LADDER_MS.length - 1);
    lockedUntil = Date.now() + LOCKOUT_LADDER_MS[ladderPos];
  }
  await Promise.all([
    SecureStore.setItemAsync(KEY_FAIL_COUNT, String(failCount)),
    lockedUntil
      ? SecureStore.setItemAsync(KEY_LOCK_UNTIL, String(lockedUntil))
      : SecureStore.deleteItemAsync(KEY_LOCK_UNTIL),
  ]);
  return { ...toStatus(failCount, lockedUntil), ok: false };
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_PIN_HASH);
  await SecureStore.deleteItemAsync(KEY_PIN_SALT);
  await SecureStore.deleteItemAsync(KEY_PIN_LEN);
  await SecureStore.deleteItemAsync(KEY_BIO_ENABLED);
  await resetLockout();
}

export async function isBiometricEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(KEY_BIO_ENABLED)) === '1';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(KEY_BIO_ENABLED, enabled ? '1' : '0');
}

export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

export async function authenticateBiometric(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Expense Manager',
    fallbackLabel: 'Use PIN',
    disableDeviceFallback: true,
  });
  return result.success;
}

export async function getPinForBackup(): Promise<{ salt: string } | null> {
  const salt = await SecureStore.getItemAsync(KEY_PIN_SALT);
  return salt ? { salt } : null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
