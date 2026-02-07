-- Fix oauth_tokens: code expects expires_in (integer seconds) and
-- x_refresh_token_expires_in, but the table was created with expires_at (timestamptz).

ALTER TABLE oauth_tokens
  ADD COLUMN IF NOT EXISTS expires_in INTEGER NOT NULL DEFAULT 3600,
  ADD COLUMN IF NOT EXISTS x_refresh_token_expires_in INTEGER NOT NULL DEFAULT 8726400;

ALTER TABLE oauth_tokens
  DROP COLUMN IF EXISTS expires_at;
