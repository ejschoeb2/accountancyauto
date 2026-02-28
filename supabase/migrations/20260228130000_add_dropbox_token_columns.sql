-- Phase 27: Add Dropbox token and OAuth state columns to organisations.
-- These columns were confirmed missing by the Phase 27 research (live schema query).
--
-- dropbox_token_expires_at: enables checkAndRefreshAccessToken() to detect expiry
--   without unnecessary refresh calls. The Dropbox SDK requires this for its built-in
--   token refresh mechanism.
-- dropbox_oauth_state: CSRF state parameter storage during the OAuth 2.0 flow.
--   Set at the start of OAuth and cleared once the callback completes.

ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS dropbox_token_expires_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dropbox_oauth_state TEXT DEFAULT NULL;
