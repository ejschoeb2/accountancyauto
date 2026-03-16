-- Schedule-level document requirements for custom deadlines.
-- Filing deadlines use filing_document_requirements (global); custom deadlines
-- use this table so each custom schedule can specify its own document checklist.

CREATE TABLE schedule_document_requirements (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  document_type_id UUID NOT NULL REFERENCES document_types(id) ON DELETE CASCADE,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (schedule_id, document_type_id)
);

ALTER TABLE schedule_document_requirements ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read requirements for schedules they can see (RLS on schedules handles org scoping)
CREATE POLICY "schedule_doc_reqs_select_authenticated"
ON schedule_document_requirements FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM schedules s
    WHERE s.id = schedule_document_requirements.schedule_id
      AND s.org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  )
);

-- Insert/update/delete allowed for org members
CREATE POLICY "schedule_doc_reqs_insert_authenticated"
ON schedule_document_requirements FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM schedules s
    WHERE s.id = schedule_document_requirements.schedule_id
      AND s.org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  )
);

CREATE POLICY "schedule_doc_reqs_update_authenticated"
ON schedule_document_requirements FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM schedules s
    WHERE s.id = schedule_document_requirements.schedule_id
      AND s.org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  )
);

CREATE POLICY "schedule_doc_reqs_delete_authenticated"
ON schedule_document_requirements FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM schedules s
    WHERE s.id = schedule_document_requirements.schedule_id
      AND s.org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  )
);

-- Service role full access
CREATE POLICY "schedule_doc_reqs_service_role_all"
ON schedule_document_requirements FOR ALL TO service_role
USING (true);
