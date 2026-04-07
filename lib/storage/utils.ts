/**
 * Storage utility functions — pure, side-effect-free helpers extracted from
 * the storage provider modules (Dropbox, Google Drive, OneDrive, token-refresh).
 *
 * All functions here are testable without mocking HTTP clients or OAuth libraries.
 * Extracted as part of AUDIT-044.
 */

// ── Token expiry ──────────────────────────────────────────────────────────────

/**
 * Returns true if the given token expiry timestamp is within `bufferMs` of now.
 *
 * The default 5-minute buffer (300 000 ms) matches the proactive refresh strategy
 * used by withTokenRefresh() in token-refresh.ts. Dropbox relies on its SDK's own
 * expiry logic, but this helper is shared for any provider that stores an expires_at.
 *
 * @param expiresAt  ISO 8601 string or Date object from the token column.
 * @param bufferMs   How many milliseconds before actual expiry to consider the token
 *                   expired. Defaults to 5 minutes (300 000 ms).
 */
export function isTokenExpired(expiresAt: string | Date, bufferMs = 5 * 60 * 1000): boolean {
  return new Date(expiresAt).getTime() < Date.now() + bufferMs;
}

// ── Dropbox error classification ──────────────────────────────────────────────

/**
 * Returns true if a Dropbox token error is unrecoverable — meaning the refresh
 * token has been permanently revoked or expired and the user must re-authenticate.
 *
 * Checked against the error messages that DropboxAuth surfaces on failed refresh:
 *   - invalid_grant          → refresh token expired / revoked by user
 *   - expired_access_token   → edge case where Dropbox surfaces this before SDK retry
 *   - Invalid refresh token  → malformed or unknown token
 *   - Token has been revoked → explicit user revocation via Dropbox account settings
 *
 * @param err  Any caught error value (unknown type).
 */
export function isDropboxUnrecoverableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes('invalid_grant') ||
    message.includes('expired_access_token') ||
    message.includes('Invalid refresh token') ||
    message.includes('Token has been revoked')
  );
}

// ── Google Drive error classification ─────────────────────────────────────────

/**
 * Returns true if a Google OAuth2 error is an invalid_grant response.
 *
 * invalid_grant is fatal — the refresh token cannot be used again and the user
 * must re-authenticate. This can be triggered by:
 *   - Password change
 *   - Token revocation via Google Account settings
 *   - Testing app 7-day expiry (Google OAuth consent screen in testing mode)
 *   - 50-refresh-token-per-user limit exceeded
 *
 * google-auth-library surfaces the error as `err.response.data.error = 'invalid_grant'`.
 * The message fallback catches edge cases where the error is thrown as a plain Error.
 *
 * @param err  Any caught error value (unknown type).
 */
export function isGoogleInvalidGrant(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const anyErr = err as Record<string, unknown>;
    const response = anyErr['response'] as Record<string, unknown> | undefined;
    if (response) {
      const data = response['data'] as Record<string, unknown> | undefined;
      if (data?.['error'] === 'invalid_grant') return true;
    }
    const message = anyErr['message'];
    if (typeof message === 'string' && message.includes('invalid_grant')) return true;
  }
  return false;
}

// ── Google Drive folder name escaping ─────────────────────────────────────────

/**
 * Escapes single quotes in a Google Drive folder name to prevent breaking the
 * Drive list API query syntax.
 *
 * Drive queries use single-quoted strings:
 *   name='O'Brien' → syntax error
 *   name='O\'Brien' → correct
 *
 * @param name  Raw folder display name (e.g. a client name).
 * @returns     Name with any `'` characters replaced by `\'`.
 */
export function escapeDriveFolderName(name: string): string {
  return name.replace(/'/g, "\\'");
}

// ── OneDrive URL construction ─────────────────────────────────────────────────

/**
 * Builds the Microsoft Graph API URL for a path-based OneDrive file upload
 * using the app-root special folder.
 *
 * Each path segment is individually encoded with encodeURIComponent so that
 * characters like spaces, ampersands, and slashes within a segment do not break
 * the path structure. The overall slashes separating segments are preserved.
 *
 * Result shape:
 *   https://graph.microsoft.com/v1.0/me/drive/special/approot:/{encoded path}:/content
 *
 * @param segments  Ordered path components: [clientName, filingTypeId, taxYear, filename].
 */
export function buildOneDriveUploadUrl(segments: string[]): string {
  const encodedPath = segments.map(encodeURIComponent).join('/');
  return `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${encodedPath}:/content`;
}

/**
 * Builds the Microsoft Graph API URL to fetch an OneDrive item's metadata
 * (specifically the @microsoft.graph.downloadUrl field).
 *
 * @param itemId  The stable OneDrive item ID (stored as storagePath).
 */
export function buildOneDriveDownloadMetaUrl(itemId: string): string {
  return `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}?$select=id,%40microsoft.graph.downloadUrl`;
}

/**
 * Builds the Microsoft Graph API URL to stream the raw bytes of an OneDrive item.
 *
 * @param itemId  The stable OneDrive item ID (stored as storagePath).
 */
export function buildOneDriveBytesUrl(itemId: string): string {
  return `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/content`;
}

/**
 * Builds the Microsoft Graph API URL to delete an OneDrive item.
 *
 * @param itemId  The stable OneDrive item ID (stored as storagePath).
 */
export function buildOneDriveDeleteUrl(itemId: string): string {
  return `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;
}

// ── Dropbox path construction ─────────────────────────────────────────────────

/**
 * Builds the Dropbox app-folder relative path for a new file upload.
 *
 * Paths are relative to the app folder root — Dropbox prepends /Apps/Prompt/
 * automatically when the app uses "App folder" access type.
 * Do NOT prefix with /Apps/Prompt/.
 *
 * Result shape:  /{clientFolder}/{filingTypeId}/{taxYear}/{uuid}.{ext}
 *
 * @param clientFolder   Client display name or ID to use as the top-level folder.
 * @param filingTypeId   Filing type identifier (e.g. "ct600").
 * @param taxYear        Tax year string (e.g. "2024").
 * @param originalFilename  Original filename — extension is extracted from this.
 * @param uuid           Pre-generated UUID for the file (caller provides for testability).
 */
export function buildDropboxUploadPath(
  clientFolder: string,
  filingTypeId: string,
  taxYear: string,
  originalFilename: string,
  uuid: string,
): string {
  const ext = originalFilename.split('.').pop()?.toLowerCase() ?? 'bin';
  return `/${clientFolder}/${filingTypeId}/${taxYear}/${uuid}.${ext}`;
}
