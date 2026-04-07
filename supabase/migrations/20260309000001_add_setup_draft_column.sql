-- Downtime risk: NONE — safe for zero-downtime deployment
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS setup_draft jsonb DEFAULT NULL;
