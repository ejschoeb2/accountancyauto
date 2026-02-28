-- Phase 25: Google Drive Integration — folder ID and token expiry columns
--
-- Adds the two columns needed by lib/storage/token-refresh.ts and GoogleDriveProvider.
-- These were described in the Phase 25 spec but are NOT present in the Phase 24 migration.
--
-- google_drive_folder_id: stores the Drive file ID of the Prompt/ root folder created
--   during the first Google Drive upload for each org.
-- google_token_expires_at: ISO timestamp used by withTokenRefresh for pre-expiry check
--   (5-minute proactive refresh window before token expires).

ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS google_token_expires_at TIMESTAMPTZ DEFAULT NULL;
