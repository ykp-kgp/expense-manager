import * as Crypto from 'expo-crypto';
import CryptoJS from 'crypto-js';

/** PIN unlock hash — tuned for mobile (4–6 digit PIN + salt). */
const PIN_HASH_ITERATIONS = 15_000;
/** Backup encryption key — stronger iteration count. */
const BACKUP_KEY_ITERATIONS = 210_000;
/** AES-256 key material. */
const KEY_BYTES = 32;
/** Master material derived for authenticated encryption: 32B enc + 32B MAC. */
const MASTER_BYTES = 64;

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
 * Derives 64 bytes of key material and splits it into an independent
 * encryption key and MAC key (encrypt-then-MAC construction).
 */
function deriveKeys(
  secret: string,
  salt: string,
  iterations: number
): { encKey: CryptoJS.lib.WordArray; macKey: CryptoJS.lib.WordArray } {
  const master = CryptoJS.PBKDF2(secret, CryptoJS.enc.Hex.parse(salt), {
    keySize: MASTER_BYTES / 4,
    iterations,
    hasher: CryptoJS.algo.SHA256,
  });
  // 16 words total → first 8 words (32B) = enc key, last 8 words (32B) = MAC key.
  const encKey = CryptoJS.lib.WordArray.create(master.words.slice(0, 8), KEY_BYTES);
  const macKey = CryptoJS.lib.WordArray.create(master.words.slice(8, 16), KEY_BYTES);
  return { encKey, macKey };
}

/** Legacy single-key derivation, kept only to decrypt v1 backups. */
export function deriveKey(pin: string, salt: string): CryptoJS.lib.WordArray {
  return CryptoJS.PBKDF2(pin, CryptoJS.enc.Hex.parse(salt), {
    keySize: KEY_BYTES / 4,
    iterations: 120_000,
    hasher: CryptoJS.algo.SHA256,
  });
}

type EncryptedPayloadV2 = {
  v: 2;
  kdf: 'PBKDF2-SHA256';
  iter: number;
  salt: string;
  iv: string;
  ct: string;
  mac: string;
};

/**
 * Encrypts `plain` with a key derived from `secret` (PIN or passphrase).
 * Uses AES-256-CBC and authenticates the ciphertext with HMAC-SHA256
 * (encrypt-then-MAC), so tampering and wrong keys are detected on decrypt.
 */
export function encryptString(plain: string, secret: string, salt: string): string {
  const iter = BACKUP_KEY_ITERATIONS;
  const { encKey, macKey } = deriveKeys(secret, salt, iter);
  const iv = CryptoJS.lib.WordArray.random(16);
  const enc = CryptoJS.AES.encrypt(plain, encKey, { iv });
  const ivHex = iv.toString(CryptoJS.enc.Hex);
  const ct = enc.toString();
  const mac = CryptoJS.HmacSHA256(macMessage(2, iter, salt, ivHex, ct), macKey).toString(
    CryptoJS.enc.Hex
  );
  const payload: EncryptedPayloadV2 = {
    v: 2,
    kdf: 'PBKDF2-SHA256',
    iter,
    salt,
    iv: ivHex,
    ct,
    mac,
  };
  return JSON.stringify(payload);
}

/** Thrown when the payload cannot be authenticated (wrong secret or tampering). */
export class DecryptionError extends Error {
  constructor(message = 'Could not decrypt: wrong PIN or corrupted data.') {
    super(message);
    this.name = 'DecryptionError';
  }
}

export function decryptString(payload: string, secret: string): string {
  let obj: Partial<EncryptedPayloadV2> & { v?: number };
  try {
    obj = JSON.parse(payload);
  } catch {
    throw new DecryptionError('Backup file is not valid.');
  }
  if (!obj || typeof obj.salt !== 'string' || typeof obj.iv !== 'string' || typeof obj.ct !== 'string') {
    throw new DecryptionError('Backup file is missing required fields.');
  }

  if (obj.v === 2) {
    if (typeof obj.mac !== 'string') throw new DecryptionError('Backup is missing its integrity tag.');
    const iter = typeof obj.iter === 'number' ? obj.iter : BACKUP_KEY_ITERATIONS;
    const { encKey, macKey } = deriveKeys(secret, obj.salt, iter);
    const expectedMac = CryptoJS.HmacSHA256(
      macMessage(2, iter, obj.salt, obj.iv, obj.ct),
      macKey
    ).toString(CryptoJS.enc.Hex);
    // Verify integrity/authenticity BEFORE attempting to decrypt.
    if (!timingSafeEqualHex(expectedMac, obj.mac)) {
      throw new DecryptionError();
    }
    const iv = CryptoJS.enc.Hex.parse(obj.iv);
    const dec = CryptoJS.AES.decrypt(obj.ct, encKey, { iv });
    return toUtf8OrThrow(dec);
  }

  // Legacy v1: unauthenticated AES-CBC. Best-effort decrypt with sanity check.
  const key = deriveKey(secret, obj.salt);
  const iv = CryptoJS.enc.Hex.parse(obj.iv);
  const dec = CryptoJS.AES.decrypt(obj.ct, key, { iv });
  return toUtf8OrThrow(dec);
}

function macMessage(v: number, iter: number, salt: string, ivHex: string, ct: string): string {
  return `${v}|${iter}|${salt}|${ivHex}|${ct}`;
}

function toUtf8OrThrow(word: CryptoJS.lib.WordArray): string {
  let text: string;
  try {
    text = word.toString(CryptoJS.enc.Utf8);
  } catch {
    throw new DecryptionError();
  }
  // A wrong key on CBC typically yields empty or invalid UTF-8.
  if (!text) throw new DecryptionError();
  return text;
}

/** Constant-time comparison of two equal-length hex strings. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
