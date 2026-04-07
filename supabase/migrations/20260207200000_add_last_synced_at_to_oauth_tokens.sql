-- Downtime risk: NONE — safe for zero-downtime deployment
-- Add last_synced_at to track when clients were last synced from QuickBooks
ALTER TABLE oauth_tokens
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
