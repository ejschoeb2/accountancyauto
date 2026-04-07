import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { encryptToken, decryptToken, rotateEncryptedValue } from './tokens';

// Valid 64-character hex string (32 bytes) — test-only, never used in production
const TEST_KEY = '0'.repeat(64);
const ALT_KEY = 'a'.repeat(64);

describe('Token Encryption (AUDIT-043)', () => {
  let savedKey: string | undefined;
  let savedPreviousKey: string | undefined;

  beforeAll(() => {
    savedKey = process.env.ENCRYPTION_KEY;
    savedPreviousKey = process.env.ENCRYPTION_KEY_PREVIOUS;
    process.env.ENCRYPTION_KEY = TEST_KEY;
    delete process.env.ENCRYPTION_KEY_PREVIOUS;
  });

  afterAll(() => {
    if (savedKey !== undefined) {
      process.env.ENCRYPTION_KEY = savedKey;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }
    if (savedPreviousKey !== undefined) {
      process.env.ENCRYPTION_KEY_PREVIOUS = savedPreviousKey;
    } else {
      delete process.env.ENCRYPTION_KEY_PREVIOUS;
    }
  });

  describe('encryptToken', () => {
    it('returns a string starting with the v1: version prefix', () => {
      const ciphertext = encryptToken('hello');
      expect(ciphertext.startsWith('v1:')).toBe(true);
    });

    it('produces a colon-delimited payload with 4 parts total (v1:iv:authTag:ciphertext)', () => {
      const ciphertext = encryptToken('hello');
      const parts = ciphertext.split(':');
      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe('v1');
    });

    it('generates a different ciphertext on each call (fresh IV)', () => {
      const a = encryptToken('same-plaintext');
      const b = encryptToken('same-plaintext');
      expect(a).not.toBe(b);
    });
  });

  describe('decryptToken round-trip', () => {
    it('decrypts back to the original ASCII string', () => {
      const plaintext = 'my-oauth-access-token';
      expect(decryptToken(encryptToken(plaintext))).toBe(plaintext);
    });

    it('throws on an empty string (empty ciphertext part cannot be round-tripped)', () => {
      // AES-256-GCM produces zero ciphertext bytes for empty plaintext, which the
      // `decryptWithKey` guard rejects as "one or more parts are empty".
      // Callers should never encrypt empty strings — use null/undefined instead.
      expect(() => decryptToken(encryptToken(''))).toThrow('one or more parts are empty');
    });

    it('round-trips a very long string (1000 chars)', () => {
      const long = 'x'.repeat(1000);
      expect(decryptToken(encryptToken(long))).toBe(long);
    });

    it('round-trips unicode / emoji characters', () => {
      const unicode = '日本語テスト 🚀 café naïve résumé';
      expect(decryptToken(encryptToken(unicode))).toBe(unicode);
    });
  });

  describe('decryptToken error cases', () => {
    it('throws when decrypting with a wrong key', () => {
      const ciphertext = encryptToken('secret');

      // Switch to a different key
      process.env.ENCRYPTION_KEY = ALT_KEY;
      expect(() => decryptToken(ciphertext)).toThrow();
      // Restore
      process.env.ENCRYPTION_KEY = TEST_KEY;
    });

    it('throws when the ciphertext has been tampered with', () => {
      const ciphertext = encryptToken('secret');
      // Flip the last character of the ciphertext
      const tampered = ciphertext.slice(0, -1) + (ciphertext.endsWith('a') ? 'b' : 'a');
      expect(() => decryptToken(tampered)).toThrow();
    });

    it('throws on a completely invalid ciphertext', () => {
      expect(() => decryptToken('not-valid-at-all')).toThrow();
    });
  });

  describe('legacy format (no v1: prefix)', () => {
    it('decrypts a legacy ciphertext using the current key', async () => {
      // Build a raw payload in the legacy iv:authTag:ciphertext format using Node crypto directly
      const { createCipheriv, randomBytes } = await import('crypto');
      const key = Buffer.from(TEST_KEY, 'hex');
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update('legacy-secret', 'utf8'), cipher.final()]);
      const authTag = cipher.getAuthTag();
      const legacyCiphertext = [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');

      // Must NOT start with v1: — this is the legacy format
      expect(legacyCiphertext.startsWith('v1:')).toBe(false);

      const decrypted = decryptToken(legacyCiphertext);
      expect(decrypted).toBe('legacy-secret');
    });

    it('falls back to ENCRYPTION_KEY_PREVIOUS for a legacy ciphertext when current key fails', async () => {
      // Encrypt a legacy payload with ALT_KEY
      const { createCipheriv, randomBytes } = await import('crypto');
      const key = Buffer.from(ALT_KEY, 'hex');
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update('old-token', 'utf8'), cipher.final()]);
      const authTag = cipher.getAuthTag();
      const legacyCiphertext = [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');

      // Current key is TEST_KEY (wrong), previous key is ALT_KEY (correct)
      process.env.ENCRYPTION_KEY = TEST_KEY;
      process.env.ENCRYPTION_KEY_PREVIOUS = ALT_KEY;

      const decrypted = decryptToken(legacyCiphertext);
      expect(decrypted).toBe('old-token');

      delete process.env.ENCRYPTION_KEY_PREVIOUS;
    });
  });

  describe('rotateEncryptedValue', () => {
    it('produces a new v1: ciphertext that decrypts to the same value', () => {
      const plaintext = 'rotate-me';
      const original = encryptToken(plaintext);
      const rotated = rotateEncryptedValue(original);

      expect(rotated.startsWith('v1:')).toBe(true);
      expect(decryptToken(rotated)).toBe(plaintext);
    });

    it('produces a different ciphertext than the input (fresh IV)', () => {
      const original = encryptToken('value');
      const rotated = rotateEncryptedValue(original);
      expect(rotated).not.toBe(original);
    });
  });
});
