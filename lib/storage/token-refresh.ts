/**
 * Google Drive OAuth2 token refresh utility.
 *
 * This is the ONLY place in the codebase that handles Google token refresh.
 * All Drive API calls (upload, download, delete) MUST go through withTokenRefresh().
 *
 * Proactive refresh strategy:
 * - If access token expires within 5 minutes, a refresh is triggered BEFORE the API call.
 * - On invalid_grant (password change, revocation, Testing app 7-day expiry, 50-token limit):
 *   1. Sets organisations.storage_backend_status = 'reauth_required'
 *   2. Nulls all Google token columns (access + refresh + expires_at)
 *   3. Re-throws — never retries on invalid_grant
 *
 * OAuth2Client construction is lazy (not at module level) — mirrors D-11-05-01 (Stripe
 * client) to prevent build failures when GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI are absent
 * at build time or in CI.
 *
 * invalid_grant errors must propagate to the caller (GoogleDriveProvider), which converts
 * them into a 500 response. The re-auth banner in the layout reads storage_backend_status
 * and informs the accountant what happened.
 */

import { auth } from '@googleapis/drive';
import type { OAuth2Client } from 'google-auth-library';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptToken, decryptToken } from '@/lib/crypto/tokens';

/** Encrypted credential bundle passed by callers of withTokenRefresh. */
export interface GoogleCredentials {
  /** AES-256-GCM encrypted access token (google_access_token_enc column). */
  access_token_enc: string;
  /** AES-256-GCM encrypted refresh token (google_refresh_token_enc column). */
  refresh_token_enc: string;
  /** ISO 8601 timestamp from google_token_expires_at column. */
  expires_at: string;
  /** Organisation ID — used to update organisations on refresh or fatal error. */
  org_id: string;
}

/**
 * Detects whether an error is an invalid_grant response from the Google OAuth2 endpoint.
 *
 * invalid_grant is fatal — the refresh token cannot be used again. Callers must not retry.
 */
function isInvalidGrant(err: unknown): boolean {
  if (err && typeof err === 'object') {
    // google-auth-library surfaces error as err.response.data.error
    const anyErr = err as Record<string, unknown>;
    const response = anyErr['response'] as Record<string, unknown> | undefined;
    if (response) {
      const data = response['data'] as Record<string, unknown> | undefined;
      if (data?.['error'] === 'invalid_grant') return true;
    }
    // Also check direct error message for edge cases
    const message = anyErr['message'];
    if (typeof message === 'string' && message.includes('invalid_grant')) return true;
  }
  return false;
}

/**
 * Nullifies all Google token columns on organisations and sets storage_backend_status
 * to 'reauth_required'. Called when invalid_grant is detected — the tokens are
 * permanently invalidated and the accountant must reconnect Google Drive.
 */
async function handleInvalidGrant(orgId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from('organisations')
    .update({
      storage_backend_status: 'reauth_required',
      google_access_token_enc: null,
      google_refresh_token_enc: null,
      google_token_expires_at: null,
    })
    .eq('id', orgId);
}

/**
 * Wraps a Google Drive API call with proactive token refresh and invalid_grant handling.
 *
 * Usage:
 * ```typescript
 * const result = await withTokenRefresh(creds, (oauth2Client) =>
 *   drive({ version: 'v3', auth: oauth2Client }).files.list({ ... })
 * );
 * ```
 *
 * @param creds  Encrypted credentials and org context from the organisations row.
 * @param call   Factory function receiving a configured OAuth2Client; should return the
 *               Drive API call result. Must not mutate the client.
 * @returns      The result of `call(oauth2Client)`.
 * @throws       Re-throws any error from token refresh or the Drive API call, including
 *               invalid_grant. Callers must not catch and suppress these errors.
 */
export async function withTokenRefresh<T>(
  creds: GoogleCredentials,
  call: (oauth2Client: OAuth2Client) => Promise<T>,
): Promise<T> {
  // Lazy OAuth2Client construction — reads env vars only at call time, not at module level.
  // This mirrors the Stripe client lazy init pattern (D-11-05-01) and prevents Next.js
  // build failures when GOOGLE_* env vars are absent (CI, local dev without Drive configured).
  const oauth2Client = new auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );

  // ── Proactive refresh: if token expires within 5 minutes, refresh now ──────────
  const expiresAtMs = new Date(creds.expires_at).getTime();
  const fiveMinutesMs = 5 * 60 * 1000;
  const needsRefresh = expiresAtMs < Date.now() + fiveMinutesMs;

  if (needsRefresh) {
    let refreshToken: string;
    try {
      refreshToken = decryptToken(creds.refresh_token_enc);
    } catch (err) {
      // Decryption failure is fatal — tokens are unusable
      await handleInvalidGrant(creds.org_id);
      throw err;
    }

    oauth2Client.setCredentials({ refresh_token: refreshToken });

    try {
      const { credentials } = await oauth2Client.refreshAccessToken();

      // Persist the new access token back to the database
      const supabase = createAdminClient();
      await supabase
        .from('organisations')
        .update({
          google_access_token_enc: encryptToken(credentials.access_token ?? ''),
          google_token_expires_at: credentials.expiry_date
            ? new Date(credentials.expiry_date).toISOString()
            : null,
          storage_backend_status: 'active',
        })
        .eq('id', creds.org_id);

      // Use the freshly obtained access token
      oauth2Client.setCredentials({ access_token: credentials.access_token });
    } catch (err) {
      if (isInvalidGrant(err)) {
        await handleInvalidGrant(creds.org_id);
      }
      // Re-throw — never retry on invalid_grant; caller converts to UI error
      throw err;
    }
  } else {
    // Token is valid for at least 5 more minutes — decrypt and use directly
    const accessToken = decryptToken(creds.access_token_enc);
    oauth2Client.setCredentials({ access_token: accessToken });
  }

  // ── Execute the Drive API call ──────────────────────────────────────────────────
  try {
    return await call(oauth2Client);
  } catch (err) {
    // Catch invalid_grant that surfaces during the actual API call (e.g. token revoked
    // mid-flight between the refresh check and the call)
    if (isInvalidGrant(err)) {
      await handleInvalidGrant(creds.org_id);
    }
    // Re-throw — never suppress Drive API errors
    throw err;
  }
}
