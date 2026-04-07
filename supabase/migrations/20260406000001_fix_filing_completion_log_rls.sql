-- Downtime risk: NONE — safe for zero-downtime deployment
-- Fix broken RLS policies on filing_completion_log.
-- The old policies used a self-referential check (org_id = org_id, always true)
-- instead of scoping to the current user's org via auth_org_id().
-- This leaked all orgs' completion log entries to every authenticated user,
-- causing the workload forecast to show green bars from other organisations.

DROP POLICY IF EXISTS "Users can view their org's completion log" ON filing_completion_log;
DROP POLICY IF EXISTS "Users can insert into their org's completion log" ON filing_completion_log;
DROP POLICY IF EXISTS "Users can update their org's completion log" ON filing_completion_log;
DROP POLICY IF EXISTS "Users can delete from their org's completion log" ON filing_completion_log;

CREATE POLICY "filing_completion_log_select"
  ON filing_completion_log FOR SELECT
  TO authenticated
  USING (org_id = auth_org_id());

CREATE POLICY "filing_completion_log_insert"
  ON filing_completion_log FOR INSERT
  TO authenticated
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "filing_completion_log_update"
  ON filing_completion_log FOR UPDATE
  TO authenticated
  USING (org_id = auth_org_id());

CREATE POLICY "filing_completion_log_delete"
  ON filing_completion_log FOR DELETE
  TO authenticated
  USING (org_id = auth_org_id());

-- Service role bypass (consistent with all other tables)
CREATE POLICY "filing_completion_log_service_role_all"
  ON filing_completion_log FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);