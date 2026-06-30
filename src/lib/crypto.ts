import * as Crypto from 'expo-crypto';
import CryptoJS from 'crypto-js';

/** PIN unlock hash — tuned for mobile (4–6 digit PIN + salt). */
const PIN_HASH_ITERATIONS = 15_000;
/** Backup encryption key — stronger iteration count. */
const BACKUP_KEY_ITERATIONS = 120_000;
const KEY_BYTES = 32;
const MAC_BYTES = 32;

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

/**
 * Derives independent encryption and MAC keys from the PIN.
 *
 * PBKDF2 output is prefix-stable, so the first 32 bytes are identical to the
 * legacy single-key derivation — this keeps v1 backups decryptable.
 */
function deriveKeys(pin: string, salt: string): {
  encKey: CryptoJS.lib.WordArray;
  macKey: CryptoJS.lib.WordArray;
} {
  const material = CryptoJS.PBKDF2(pin, CryptoJS.enc.Hex.parse(salt), {
    keySize: (KEY_BYTES + MAC_BYTES) / 4,
    iterations: BACKUP_KEY_ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  });
  const words = material.words;
  const encKey = CryptoJS.lib.WordArray.create(words.slice(0, KEY_BYTES / 4), KEY_BYTES);
  const macKey = CryptoJS.lib.WordArray.create(
    words.slice(KEY_BYTES / 4, (KEY_BYTES + MAC_BYTES) / 4),
    MAC_BYTES
  );
  return { encKey, macKey };
}

/** Constant-time comparison of two hex strings. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function encryptString(plain: string, pin: string, salt: string): string {
  const { encKey, macKey } = deriveKeys(pin, salt);
  const iv = CryptoJS.lib.WordArray.random(16);
  const enc = CryptoJS.AES.encrypt(plain, encKey, { iv });
  const ivHex = iv.toString(CryptoJS.enc.Hex);
  const ct = enc.toString();
  // Encrypt-then-MAC over the IV and ciphertext for tamper detection and
  // precise wrong-PIN detection on restore.
  const mac = CryptoJS.HmacSHA256(ivHex + ct, macKey).toString(CryptoJS.enc.Hex);
  return JSON.stringify({ v: 2, salt, iv: ivHex, ct, mac });
}

export function decryptString(payload: string, pin: string): string {
  let obj: { v?: number; salt: string; iv: string; ct: string; mac?: string };
  try {
    obj = JSON.parse(payload);
  } catch {
    throw new Error('Incorrect PIN or corrupted backup.');
  }
  const { encKey, macKey } = deriveKeys(pin, obj.salt);

  if (obj.mac) {
    const expected = CryptoJS.HmacSHA256(obj.iv + obj.ct, macKey).toString(CryptoJS.enc.Hex);
    if (!timingSafeEqualHex(expected, obj.mac)) {
      throw new Error('Incorrect PIN or corrupted backup.');
    }
  }

  const iv = CryptoJS.enc.Hex.parse(obj.iv);
  const dec = CryptoJS.AES.decrypt(obj.ct, encKey, { iv });
  const text = dec.toString(CryptoJS.enc.Utf8);
  if (!text) throw new Error('Incorrect PIN or corrupted backup.');
  return text;
}
