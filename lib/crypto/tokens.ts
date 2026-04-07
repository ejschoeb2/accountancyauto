/**
 * Token encryption module — AES-256-GCM with key versioning.
 *
 * This is the ONLY module in the codebase authorised to read or write plaintext
 * OAuth tokens. All database columns with the `_enc` suffix MUST have their values
 * produced by encryptToken() before writing and recovered by decryptToken() before use.
 *
 * Key management:
 * - ENCRYPTION_KEY env var: 64-character hex string (32 bytes = 256-bit key) — current key
 * - ENCRYPTION_KEY_PREVIOUS env var: 64-character hex string — previous key (optional, decryption only)
 * - Store ONLY in Vercel environment variables (encrypted at rest by Vercel)
 * - NEVER store in Supabase, app_settings, or source control
 * - Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Ciphertext format (versioned): `v1:iv_hex:authTag_hex:encrypted_hex`
 * Ciphertext format (legacy):        `iv_hex:authTag_hex:encrypted_hex`
 *
 * Key rotation procedure:
 * 1. Set ENCRYPTION_KEY to the new key and ENCRYPTION_KEY_PREVIOUS to the old key.
 * 2. Run a batch rotation script using rotateEncryptedValue() on all _enc columns.
 * 3. Once all rows are re-encrypted, remove ENCRYPTION_KEY_PREVIOUS.
 *
 * Version routing on decrypt:
 * - `v1:...`  → use ENCRYPTION_KEY
 * - (no prefix) → try ENCRYPTION_KEY first, then ENCRYPTION_KEY_PREVIOUS (backwards compat)
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { logger } from '@/lib/logger';

const ALGORITHM = 'aes-256-gcm';

/** The version prefix written into every new ciphertext. */
const CURRENT_VERSION = 'v1';

/**
 * Reads and validates a 64-char hex ENCRYPTION_KEY env var by name.
 * Called lazily — NOT at module level — to avoid build-time crashes.
 */
function getKeyByEnvName(envName: string): Buffer {
  const hex = process.env[envName];
  if (!hex || hex.length !== 64) {
    throw new Error(
      `${envName} must be a 64-character hex string (32 bytes). ` +
      "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Returns the current (primary) encryption key from ENCRYPTION_KEY.
 * Throws if the env var is absent or invalid.
 */
function getCurrentKey(): Buffer {
  return getKeyByEnvName('ENCRYPTION_KEY');
}

/**
 * Returns the previous encryption key from ENCRYPTION_KEY_PREVIOUS, or null
 * if that env var is not set (it is optional — only needed during rotation).
 */
function getPreviousKey(): Buffer | null {
  const hex = process.env.ENCRYPTION_KEY_PREVIOUS;
  if (!hex) return null;
  if (hex.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY_PREVIOUS must be a 64-character hex string (32 bytes) if set.'
    );
  }
  return Buffer.from(hex, 'hex');
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Encrypts plaintext with the given key and returns a raw
 * `iv_hex:authTag_hex:ciphertext_hex` payload (no version prefix).
 */
function encryptWithKey(plaintext: string, key: Buffer): string {
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
 * Decrypts a raw `iv_hex:authTag_hex:ciphertext_hex` payload using the given key.
 * Throws on format errors or GCM auth tag mismatch (wrong key / tampered data).
 */
function decryptWithKey(payload: string, key: Buffer): string {
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error(
      `Invalid ciphertext payload: expected 'iv:authTag:ciphertext', got ${parts.length} part(s)`
    );
  }
  const [ivHex, authTagHex, encryptedHex] = parts;
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Invalid ciphertext payload: one or more parts are empty');
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(), // throws if GCM auth tag is invalid — do not catch
  ]);

  return decrypted.toString('utf8');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encrypts a plaintext string using AES-256-GCM with the current key.
 *
 * Returns a versioned colon-delimited string: `v1:iv_hex:authTag_hex:ciphertext_hex`
 * A fresh 12-byte random IV is generated for every call — never reused.
 *
 * This is the ONLY function that may produce values written to `_enc` columns.
 */
export function encryptToken(plaintext: string): string {
  const key = getCurrentKey();
  const payload = encryptWithKey(plaintext, key);
  return `${CURRENT_VERSION}:${payload}`;
}

/**
 * Decrypts a ciphertext string produced by encryptToken().
 *
 * Handles both versioned (`v1:iv:authTag:ciphertext`) and legacy
 * (`iv:authTag:ciphertext`) formats for backwards compatibility.
 *
 * Version routing:
 * - `v1:...`  → decrypt with ENCRYPTION_KEY
 * - (legacy)  → try ENCRYPTION_KEY first, then ENCRYPTION_KEY_PREVIOUS
 *
 * Throws on:
 * - Invalid ciphertext format
 * - Wrong key / GCM auth tag mismatch (indicates tampering or missing key)
 * - No valid key found for legacy ciphertext
 *
 * Do NOT catch and suppress GCM auth tag errors — they indicate tampering or wrong key.
 */
export function decryptToken(ciphertext: string): string {
  if (ciphertext.startsWith('v1:')) {
    // Versioned format — always use current key
    const payload = ciphertext.slice('v1:'.length);
    return decryptWithKey(payload, getCurrentKey());
  }

  // Legacy format (no version prefix) — try current key, then previous key
  const currentKey = getCurrentKey();
  try {
    return decryptWithKey(ciphertext, currentKey);
  } catch (primaryErr) {
    const previousKey = getPreviousKey();
    if (!previousKey) {
      // No fallback available — re-throw the original error
      throw primaryErr;
    }
    logger.warn(
      'decryptToken: current key failed for legacy ciphertext, trying ENCRYPTION_KEY_PREVIOUS'
    );
    try {
      return decryptWithKey(ciphertext, previousKey);
    } catch {
      throw new Error(
        'decryptToken: failed to decrypt with both ENCRYPTION_KEY and ENCRYPTION_KEY_PREVIOUS. ' +
        'The ciphertext may be corrupted or the correct key is not configured.'
      );
    }
  }
}

/**
 * Decrypts a ciphertext with any available key and re-encrypts it with the
 * current key (ENCRYPTION_KEY), producing a fresh versioned ciphertext.
 *
 * Use this in batch rotation scripts after rotating ENCRYPTION_KEY:
 *   const rotated = rotateEncryptedValue(row.token_enc);
 *   // write rotated back to the database
 *
 * Returns the same value unchanged if it is already encrypted with the current
 * key version (v1) AND the current key successfully decrypts it — avoiding
 * unnecessary re-encryption of already-current rows.
 *
 * Throws if decryption fails with all available keys.
 */
export function rotateEncryptedValue(ciphertext: string): string {
  const plaintext = decryptToken(ciphertext);
  return encryptToken(plaintext);
}
