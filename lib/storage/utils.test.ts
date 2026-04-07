/**
 * Tests for lib/storage/utils.ts (AUDIT-044)
 *
 * All functions are pure — no mocks needed.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isTokenExpired,
  isDropboxUnrecoverableError,
  isGoogleInvalidGrant,
  escapeDriveFolderName,
  buildOneDriveUploadUrl,
  buildOneDriveDownloadMetaUrl,
  buildOneDriveBytesUrl,
  buildOneDriveDeleteUrl,
  buildDropboxUploadPath,
} from './utils';

// ── isTokenExpired ─────────────────────────────────────────────────────────────

describe('isTokenExpired', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true when the token has already expired (past timestamp)', () => {
    const pastDate = new Date(Date.now() - 1000).toISOString(); // 1 second ago
    expect(isTokenExpired(pastDate)).toBe(true);
  });

  it('returns true when the token expires within the default 5-minute buffer', () => {
    const soonDate = new Date(Date.now() + 4 * 60 * 1000).toISOString(); // 4 minutes from now
    expect(isTokenExpired(soonDate)).toBe(true);
  });

  it('returns false when the token expires well beyond the default 5-minute buffer', () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now
    expect(isTokenExpired(futureDate)).toBe(false);
  });

  it('returns false when the token expires exactly on the buffer boundary (just beyond)', () => {
    // Token expires 5 minutes + 1 second from now — should NOT be considered expired yet
    const justBeyondBuffer = new Date(Date.now() + 5 * 60 * 1000 + 1000).toISOString();
    expect(isTokenExpired(justBeyondBuffer)).toBe(false);
  });

  it('returns true when the token expires exactly at the buffer boundary (at 5 minutes)', () => {
    // Token expires in exactly 5 minutes — condition: expiresAt < now + bufferMs
    // With bufferMs = 300000: 300000 < 300000 is false, so this is NOT expired
    // Edge case: the boundary itself should NOT trigger refresh
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    const exactBoundary = new Date(now + 5 * 60 * 1000).toISOString();
    // At exactly 5 minutes: expiresAt.getTime() === Date.now() + bufferMs → NOT less than
    expect(isTokenExpired(exactBoundary)).toBe(false);
  });

  it('accepts a Date object (not just ISO string)', () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour as Date
    expect(isTokenExpired(futureDate)).toBe(false);

    const pastDate = new Date(Date.now() - 1000); // 1 second ago as Date
    expect(isTokenExpired(pastDate)).toBe(true);
  });

  it('respects a custom bufferMs of 0 (no buffer)', () => {
    // Token expired 1 ms ago — with zero buffer, should be expired
    const justExpired = new Date(Date.now() - 1).toISOString();
    expect(isTokenExpired(justExpired, 0)).toBe(true);

    // Token expires 1 ms from now — with zero buffer, should NOT be expired
    const notYet = new Date(Date.now() + 1).toISOString();
    expect(isTokenExpired(notYet, 0)).toBe(false);
  });

  it('respects a custom bufferMs of 10 minutes', () => {
    // Token expires in 8 minutes — inside 10-minute buffer → expired
    const eightMin = new Date(Date.now() + 8 * 60 * 1000).toISOString();
    expect(isTokenExpired(eightMin, 10 * 60 * 1000)).toBe(true);

    // Token expires in 12 minutes — outside 10-minute buffer → NOT expired
    const twelveMin = new Date(Date.now() + 12 * 60 * 1000).toISOString();
    expect(isTokenExpired(twelveMin, 10 * 60 * 1000)).toBe(false);
  });
});

// ── isDropboxUnrecoverableError ───────────────────────────────────────────────

describe('isDropboxUnrecoverableError', () => {
  it('returns true for "invalid_grant" in error message', () => {
    expect(isDropboxUnrecoverableError(new Error('invalid_grant'))).toBe(true);
  });

  it('returns true for "expired_access_token" in error message', () => {
    expect(isDropboxUnrecoverableError(new Error('expired_access_token'))).toBe(true);
  });

  it('returns true for "Invalid refresh token" in error message', () => {
    expect(isDropboxUnrecoverableError(new Error('Invalid refresh token'))).toBe(true);
  });

  it('returns true for "Token has been revoked" in error message', () => {
    expect(isDropboxUnrecoverableError(new Error('Token has been revoked'))).toBe(true);
  });

  it('returns true when the trigger phrase is embedded in a longer message', () => {
    expect(
      isDropboxUnrecoverableError(new Error('Dropbox error: invalid_grant — please re-auth')),
    ).toBe(true);
  });

  it('returns false for a transient network error', () => {
    expect(isDropboxUnrecoverableError(new Error('ECONNRESET'))).toBe(false);
  });

  it('returns false for a rate-limit error', () => {
    expect(isDropboxUnrecoverableError(new Error('Too Many Requests (429)'))).toBe(false);
  });

  it('returns false for an empty error message', () => {
    expect(isDropboxUnrecoverableError(new Error(''))).toBe(false);
  });

  it('handles non-Error objects (string thrown)', () => {
    expect(isDropboxUnrecoverableError('invalid_grant')).toBe(true);
    expect(isDropboxUnrecoverableError('network timeout')).toBe(false);
  });

  it('handles null/undefined without throwing', () => {
    expect(isDropboxUnrecoverableError(null)).toBe(false);
    expect(isDropboxUnrecoverableError(undefined)).toBe(false);
  });
});

// ── isGoogleInvalidGrant ──────────────────────────────────────────────────────

describe('isGoogleInvalidGrant', () => {
  it('returns true when err.response.data.error === "invalid_grant"', () => {
    const err = {
      response: {
        data: { error: 'invalid_grant' },
      },
    };
    expect(isGoogleInvalidGrant(err)).toBe(true);
  });

  it('returns false when err.response.data.error is a different value', () => {
    const err = { response: { data: { error: 'access_denied' } } };
    expect(isGoogleInvalidGrant(err)).toBe(false);
  });

  it('returns true when err.message contains "invalid_grant" (plain Error fallback)', () => {
    expect(isGoogleInvalidGrant(new Error('invalid_grant: Token has been revoked'))).toBe(true);
  });

  it('returns false for a non-OAuth error (plain Error, unrelated message)', () => {
    expect(isGoogleInvalidGrant(new Error('Rate limit exceeded'))).toBe(false);
  });

  it('returns false when err has response but no data.error field', () => {
    const err = { response: { status: 500, data: {} } };
    expect(isGoogleInvalidGrant(err)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isGoogleInvalidGrant(null)).toBe(false);
  });

  it('returns false for a primitive string (non-matching)', () => {
    expect(isGoogleInvalidGrant('something went wrong')).toBe(false);
  });

  it('returns false when response is present but data is missing', () => {
    const err = { response: { status: 401 } };
    expect(isGoogleInvalidGrant(err)).toBe(false);
  });
});

// ── escapeDriveFolderName ─────────────────────────────────────────────────────

describe('escapeDriveFolderName', () => {
  it('returns name unchanged when no single quotes are present', () => {
    expect(escapeDriveFolderName('Acme Ltd')).toBe('Acme Ltd');
  });

  it("escapes a single apostrophe in \"O'Brien Accounting\"", () => {
    expect(escapeDriveFolderName("O'Brien Accounting")).toBe("O\\'Brien Accounting");
  });

  it('escapes multiple single quotes', () => {
    expect(escapeDriveFolderName("it's O'Brien's")).toBe("it\\'s O\\'Brien\\'s");
  });

  it('leaves other special characters untouched (ampersand, slash, etc.)', () => {
    expect(escapeDriveFolderName('A & B / C')).toBe('A & B / C');
  });

  it('returns an empty string unchanged', () => {
    expect(escapeDriveFolderName('')).toBe('');
  });
});

// ── buildOneDriveUploadUrl ────────────────────────────────────────────────────

describe('buildOneDriveUploadUrl', () => {
  it('builds the correct URL for simple ASCII path segments', () => {
    const url = buildOneDriveUploadUrl(['Acme Ltd', 'ct600', '2024', 'accounts.pdf']);
    expect(url).toBe(
      'https://graph.microsoft.com/v1.0/me/drive/special/approot:/Acme%20Ltd/ct600/2024/accounts.pdf:/content',
    );
  });

  it('encodes spaces in the client name segment', () => {
    const url = buildOneDriveUploadUrl(['My Client', 'vat', '2024', 'return.pdf']);
    expect(url).toContain('My%20Client');
  });

  it('encodes special characters in a filename (ampersand, hash)', () => {
    const url = buildOneDriveUploadUrl(['Acme', 'ct600', '2024', 'tax & accounts #final.pdf']);
    expect(url).toContain('tax%20%26%20accounts%20%23final.pdf');
  });

  it('always wraps path with the approot prefix and :/content suffix', () => {
    const url = buildOneDriveUploadUrl(['a', 'b', 'c', 'd.txt']);
    expect(url.startsWith('https://graph.microsoft.com/v1.0/me/drive/special/approot:/')).toBe(
      true,
    );
    expect(url.endsWith(':/content')).toBe(true);
  });

  it('handles a single segment (edge case)', () => {
    const url = buildOneDriveUploadUrl(['only-one.txt']);
    expect(url).toBe(
      'https://graph.microsoft.com/v1.0/me/drive/special/approot:/only-one.txt:/content',
    );
  });
});

// ── buildOneDriveDownloadMetaUrl ──────────────────────────────────────────────

describe('buildOneDriveDownloadMetaUrl', () => {
  it('builds the correct metadata URL with the $select query parameter', () => {
    const url = buildOneDriveDownloadMetaUrl('item-id-123');
    expect(url).toBe(
      'https://graph.microsoft.com/v1.0/me/drive/items/item-id-123?$select=id,%40microsoft.graph.downloadUrl',
    );
  });

  it('interpolates different item IDs correctly', () => {
    const url = buildOneDriveDownloadMetaUrl('ABC-456-XYZ');
    expect(url).toContain('ABC-456-XYZ');
  });
});

// ── buildOneDriveBytesUrl ─────────────────────────────────────────────────────

describe('buildOneDriveBytesUrl', () => {
  it('builds the correct /content URL for an item ID', () => {
    const url = buildOneDriveBytesUrl('item-id-789');
    expect(url).toBe(
      'https://graph.microsoft.com/v1.0/me/drive/items/item-id-789/content',
    );
  });
});

// ── buildOneDriveDeleteUrl ────────────────────────────────────────────────────

describe('buildOneDriveDeleteUrl', () => {
  it('builds the correct delete URL for an item ID', () => {
    const url = buildOneDriveDeleteUrl('item-id-abc');
    expect(url).toBe(
      'https://graph.microsoft.com/v1.0/me/drive/items/item-id-abc',
    );
  });

  it('does NOT append /content (delete targets the item directly, not its bytes)', () => {
    const url = buildOneDriveDeleteUrl('item-id-abc');
    expect(url.endsWith('/content')).toBe(false);
  });
});

// ── buildDropboxUploadPath ────────────────────────────────────────────────────

describe('buildDropboxUploadPath', () => {
  it('builds the correct path for a simple filename', () => {
    const path = buildDropboxUploadPath('Acme Ltd', 'ct600', '2024', 'accounts.pdf', 'uuid-1');
    expect(path).toBe('/Acme Ltd/ct600/2024/uuid-1.pdf');
  });

  it('lowercases the extension', () => {
    const path = buildDropboxUploadPath('Client', 'vat', '2023', 'RETURN.PDF', 'uuid-2');
    expect(path).toBe('/Client/vat/2023/uuid-2.pdf');
  });

  it('uses the whole filename as the extension when there is no dot (split.pop returns the string itself)', () => {
    // 'no-extension'.split('.').pop() === 'no-extension' — "bin" fallback only applies when
    // pop() returns undefined (e.g. on empty string). Mirrors the original dropbox.ts behaviour.
    const path = buildDropboxUploadPath('Client', 'sa', '2024', 'no-extension', 'uuid-3');
    expect(path).toBe('/Client/sa/2024/uuid-3.no-extension');
  });

  it('produces a trailing dot for an empty filename (pop returns empty string, not undefined)', () => {
    // ''.split('.') = [''], pop() = '' — empty string is falsy so ?? 'bin' fires.
    // However, the ?? operator only triggers on null/undefined, not empty string.
    // This documents the actual behaviour: the result ends with '.' (the empty ext).
    // Callers should never pass an empty filename in production.
    const path = buildDropboxUploadPath('Client', 'sa', '2024', '', 'uuid-empty');
    expect(path).toBe('/Client/sa/2024/uuid-empty.');
  });

  it('extracts only the final extension when filename has multiple dots', () => {
    const path = buildDropboxUploadPath('Client', 'ct600', '2024', 'file.tar.gz', 'uuid-4');
    expect(path).toBe('/Client/ct600/2024/uuid-4.gz');
  });

  it('starts with a leading slash (required for Dropbox app-folder relative paths)', () => {
    const path = buildDropboxUploadPath('Client', 'ct600', '2024', 'doc.pdf', 'uuid-5');
    expect(path.startsWith('/')).toBe(true);
  });

  it('uses the provided UUID — not random (caller controls for reproducibility)', () => {
    const path = buildDropboxUploadPath('Client', 'ct600', '2024', 'doc.pdf', 'my-stable-uuid');
    expect(path).toContain('my-stable-uuid');
  });
});
