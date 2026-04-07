-- Immutable audit log for tracking data mutations
-- INSERT only — no UPDATE or DELETE policies
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id),
  user_id UUID,
  action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete', 'bulk_create', 'bulk_delete')),
  table_name VARCHAR(100) NOT NULL,
  row_id UUID,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB, -- additional context (e.g., IP, user agent, correlation_id)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for common queries
CREATE INDEX idx_audit_log_org_created ON audit_log(org_id, created_at DESC);
CREATE INDEX idx_audit_log_table_row ON audit_log(table_name, row_id);

-- RLS: users can only read their org's audit logs
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own org audit logs" ON audit_log
  FOR SELECT TO authenticated
  USING (org_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'org_id')::uuid);

-- INSERT only — no one can update or delete audit logs via API
CREATE POLICY "Service role can insert audit logs" ON audit_log
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Prevent UPDATE and DELETE entirely
CREATE POLICY "No updates allowed" ON audit_log
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "No deletes allowed" ON audit_log
  FOR DELETE TO authenticated
  USING (false);
