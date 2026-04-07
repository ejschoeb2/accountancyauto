-- Downtime risk: NONE — safe for zero-downtime deployment
-- Add ms_home_account_id column to organisations for OneDrive OAuth2 (Phase 26)
-- ms_token_cache_enc already exists from Phase 24 (storage abstraction schema)
-- This column stores the MSAL home account identifier for the connected Microsoft account
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS ms_home_account_id TEXT DEFAULT NULL;
