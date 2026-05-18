import * as Crypto from 'expo-crypto';
import CryptoJS from 'crypto-js';

/** PIN unlock hash — tuned for mobile (4–6 digit PIN + salt). */
const PIN_HASH_ITERATIONS = 15_000;
/** Backup encryption key — stronger iteration count. */
const BACKUP_KEY_ITERATIONS = 120_000;
const KEY_BYTES = 32;

export async function generateSalt(byteLength = 16): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(byteLength);
  return bytesToHex(bytes);
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hashPin(pin: string, salt: string): string {
  const wordArray = CryptoJS.PBKDF2(pin, CryptoJS.enc.Hex.parse(salt), {
    keySize: KEY_BYTES / 4,
    iterations: PIN_HASH_ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  });
  return wordArray.toString(CryptoJS.enc.Hex);
}

export function deriveKey(pin: string, salt: string): CryptoJS.lib.WordArray {
  return CryptoJS.PBKDF2(pin, CryptoJS.enc.Hex.parse(salt), {
    keySize: KEY_BYTES / 4,
    iterations: BACKUP_KEY_ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  });
}

export function encryptString(plain: string, pin: string, salt: string): string {
  const key = deriveKey(pin, salt);
  const iv = CryptoJS.lib.WordArray.random(16);
  const enc = CryptoJS.AES.encrypt(plain, key, { iv });
  return JSON.stringify({
    v: 1,
    salt,
    iv: iv.toString(CryptoJS.enc.Hex),
    ct: enc.toString(),
  });
}

export function decryptString(payload: string, pin: string): string {
  const obj = JSON.parse(payload) as { salt: string; iv: string; ct: string };
  const key = deriveKey(pin, obj.salt);
  const iv = CryptoJS.enc.Hex.parse(obj.iv);
  const dec = CryptoJS.AES.decrypt(obj.ct, key, { iv });
  return dec.toString(CryptoJS.enc.Utf8);
}
