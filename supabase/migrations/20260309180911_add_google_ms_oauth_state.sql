-- Add DB-based OAuth state columns for Google Drive and OneDrive.
-- Mirrors the existing dropbox_oauth_state pattern — cookie-based CSRF
-- fails cross-subdomain (org subdomain sets cookie, callback URL is on
-- the main app domain where the cookie isn't available).

ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS google_oauth_state text,
  ADD COLUMN IF NOT EXISTS ms_oauth_state text;

COMMENT ON COLUMN organisations.google_oauth_state IS 'CSRF state token for in-flight Google Drive OAuth flow (DB-based, mirrors dropbox_oauth_state)';
COMMENT ON COLUMN organisations.ms_oauth_state IS 'CSRF state token for in-flight Microsoft OneDrive OAuth flow (DB-based, mirrors dropbox_oauth_state)';
