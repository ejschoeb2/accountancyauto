-- Phase 19: Collection Mechanisms - Schema Prerequisites
--
-- Applies three schema additions required across Phase 19 plans:
--
-- 1. revoked_at TIMESTAMPTZ on upload_portal_tokens (deferred from Phase 18)
--    Needed by ACTV-03 (portal token revocation endpoint)
--
-- 2. client_document_checklist_customisations table (needed by ACTV-04)
--    Allows per-client, per-filing-type document checklist overrides
--
-- 3. Supabase Realtime publication for client_documents (needed by DASH-03)
--    Enables live document count updates on the dashboard

-- ============================================================================
-- 1. upload_portal_tokens.revoked_at
-- Deferred from Phase 18 — required for ACTV-03 token revocation
-- ============================================================================

ALTER TABLE upload_portal_tokens
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_upload_portal_tokens_revoked
  ON upload_portal_tokens(revoked_at)
  WHERE revoked_at IS NOT NULL;

-- ============================================================================
-- 2. client_document_checklist_customisations
-- Per-client, per-filing-type document checklist overrides
-- Allows accountants to add ad-hoc document requests or disable defaults
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_document_checklist_customisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  filing_type_id TEXT NOT NULL REFERENCES filing_types(id),
  document_type_id UUID REFERENCES document_types(id),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  is_ad_hoc BOOLEAN NOT NULL DEFAULT false,
  ad_hoc_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, filing_type_id, document_type_id)
);

-- RLS: org-scoped, same pattern as client_documents and other tenant tables
ALTER TABLE client_document_checklist_customisations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customisations_select" ON client_document_checklist_customisations
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "customisations_insert" ON client_document_checklist_customisations
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "customisations_update" ON client_document_checklist_customisations
  FOR UPDATE USING (org_id = auth_org_id());

CREATE POLICY "customisations_delete" ON client_document_checklist_customisations
  FOR DELETE USING (org_id = auth_org_id());

CREATE POLICY "customisations_service_role_all" ON client_document_checklist_customisations
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_checklist_customisations_client_filing
  ON client_document_checklist_customisations(client_id, filing_type_id);

CREATE INDEX idx_checklist_customisations_org_id
  ON client_document_checklist_customisations(org_id);

-- ============================================================================
-- 3. Supabase Realtime publication for client_documents
-- Idempotent — safe to run even if already added.
-- Enables real-time document count updates for the dashboard (DASH-03).
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE client_documents;
