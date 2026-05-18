import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { generateSalt, hashPin } from './crypto';

const KEY_PIN_HASH = 'em.pin_hash';
const KEY_PIN_SALT = 'em.pin_salt';
const KEY_BIO_ENABLED = 'em.bio_enabled';

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
  ]);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const salt = await SecureStore.getItemAsync(KEY_PIN_SALT);
  const stored = await SecureStore.getItemAsync(KEY_PIN_HASH);
  if (!salt || !stored) return false;
  const computed = hashPin(pin, salt);
  return timingSafeEqual(computed, stored);
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_PIN_HASH);
  await SecureStore.deleteItemAsync(KEY_PIN_SALT);
  await SecureStore.deleteItemAsync(KEY_BIO_ENABLED);
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
