-- Phase 31: Setup draft clients staging table for large CSV imports
CREATE TABLE setup_draft_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (org_id, row_index)
);

ALTER TABLE setup_draft_clients ENABLE ROW LEVEL SECURITY;

-- Service role full access (all access goes through admin client in server actions)
CREATE POLICY "Service role full access to setup_draft_clients"
  ON setup_draft_clients FOR ALL TO service_role
  USING (true) WITH CHECK (true);
