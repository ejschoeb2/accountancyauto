/**
 * Token encryption module — AES-256-GCM.
 *
 * This is the ONLY module in the codebase authorised to read or write plaintext
 * OAuth tokens. All database columns with the `_enc` suffix MUST have their values
 * produced by encryptToken() before writing and recovered by decryptToken() before use.
 *
 * Key management:
 * - ENCRYPTION_KEY env var: 64-character hex string (32 bytes = 256-bit key)
 * - Store ONLY in Vercel environment variables (encrypted at rest by Vercel)
 * - NEVER store in Supabase, app_settings, or source control
 * - Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Ciphertext format: `iv_hex:authTag_hex:encrypted_hex` (colon-delimited, all hex-encoded)
 * This self-contained format requires no external metadata for decryption.
 *
 * Key rotation: if ENCRYPTION_KEY is rotated, all existing _enc columns must be
 * re-encrypted (decrypt with old key, encrypt with new key) before discarding the old key.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Reads and validates ENCRYPTION_KEY from the environment.
 * Called lazily inside encryptToken/decryptToken — NOT at module level.
 * Module-level key reading crashes the Next.js build when the env var is absent (e.g. CI).
 */
function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * Returns a colon-delimited string: `iv_hex:authTag_hex:ciphertext_hex`
 * A fresh 12-byte random IV is generated for every call — never reused.
 *
 * This is the ONLY function that may produce values written to `_enc` columns.
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV — GCM standard; fresh per call, never reuse
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

/**
 * Decrypts a ciphertext string produced by encryptToken().
 *
 * Throws on:
 * - Invalid ciphertext format (not three colon-separated hex parts)
 * - Wrong ENCRYPTION_KEY (auth tag mismatch — GCM integrity check)
 * - Corrupted ciphertext (any bit tampered)
 *
 * Do NOT catch and suppress GCM auth tag errors — they indicate tampering or wrong key.
 */
export function decryptToken(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error(
      `Invalid ciphertext format: expected 'iv:authTag:ciphertext', got ${parts.length} part(s)`
    );
  }
  const [ivHex, authTagHex, encryptedHex] = parts;
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Invalid ciphertext format: one or more parts are empty');
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(), // throws if GCM auth tag is invalid — do not catch
  ]);

  return decrypted.toString('utf8');
}
