-- Add client portal enabled flag to organisations
-- Defaults to true for all existing orgs (opt-out model)
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS client_portal_enabled BOOLEAN NOT NULL DEFAULT true;
