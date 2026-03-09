ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS setup_draft jsonb DEFAULT NULL;
