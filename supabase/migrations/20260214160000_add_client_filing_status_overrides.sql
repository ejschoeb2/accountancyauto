-- Table for storing manual status overrides per client per filing type
CREATE TABLE IF NOT EXISTS client_filing_status_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  filing_type_id TEXT NOT NULL REFERENCES filing_types(id) ON DELETE CASCADE,
  override_status TEXT NOT NULL CHECK (override_status IN ('green', 'amber', 'red')),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, filing_type_id)
);

CREATE INDEX idx_client_filing_status_overrides_client
  ON client_filing_status_overrides(client_id);

-- RLS Policies
ALTER TABLE client_filing_status_overrides ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (idempotent)
DROP POLICY IF EXISTS "Authenticated users can manage status overrides" ON client_filing_status_overrides;
DROP POLICY IF EXISTS "Service role full access to status overrides" ON client_filing_status_overrides;

-- Create policies
CREATE POLICY "Authenticated users can manage status overrides"
  ON client_filing_status_overrides FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to status overrides"
  ON client_filing_status_overrides FOR ALL TO service_role
  USING (true) WITH CHECK (true);
