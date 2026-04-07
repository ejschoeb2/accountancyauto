-- Downtime risk: NONE — safe for zero-downtime deployment
-- Phase 18: Document Collection Foundation - Table DDL
-- Creates five tables for document collection in order of FK dependencies:
-- 1. document_types (global reference, no org_id)
-- 2. filing_document_requirements (global reference, no org_id)
-- 3. client_documents (org-scoped tenant table)
-- 4. document_access_log (org-scoped, INSERT-only for authenticated)
-- 5. upload_portal_tokens (org-scoped)

-- ============================================================================
-- 1. document_types
-- Global reference table — readable by all authenticated users (like filing_types)
-- No org_id; seed data is immutable for users
-- ============================================================================

CREATE TABLE document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,                        -- machine code: 'P60', 'BANK_STATEMENT', etc.
  label TEXT NOT NULL,                              -- display: 'P60 End-of-Year Certificate'
  description TEXT NOT NULL,                       -- portal checklist text
  default_retention_years INT NOT NULL,             -- statutory retention (5 for SA100 docs; 6 for others)
  expected_mime_types TEXT[],                       -- nullable; e.g. ARRAY['application/pdf', 'image/jpeg']
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_types_select_authenticated"
ON document_types FOR SELECT TO authenticated
USING (true);

CREATE POLICY "document_types_service_role_all"
ON document_types FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ============================================================================
-- 2. filing_document_requirements
-- Global reference table mapping document types to filing types
-- No org_id; globally readable by authenticated users
-- ============================================================================

CREATE TABLE filing_document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filing_type_id TEXT NOT NULL REFERENCES filing_types(id),
  document_type_id UUID NOT NULL REFERENCES document_types(id),
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(filing_type_id, document_type_id)
);

ALTER TABLE filing_document_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "filing_document_requirements_select_authenticated"
ON filing_document_requirements FOR SELECT TO authenticated
USING (true);

CREATE POLICY "filing_document_requirements_service_role_all"
ON filing_document_requirements FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ============================================================================
-- 3. client_documents
-- Org-scoped tenant table for document metadata
-- tax_period_end_date and retention_hold are NOT NULL (critical for HMRC compliance)
-- ============================================================================

CREATE TABLE client_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  filing_type_id TEXT NOT NULL REFERENCES filing_types(id),
  document_type_id UUID REFERENCES document_types(id),             -- nullable for unclassified
  storage_path TEXT NOT NULL,                                       -- orgs/{org_id}/clients/{client_id}/{filing_type_id}/{tax_year}/{uuid}.ext
  original_filename TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tax_period_end_date DATE NOT NULL,                               -- retention anchor (HMRC TMA 1970 s12B / CH14600) — NOT NULL is critical
  retain_until DATE NOT NULL,                                      -- derived at upload time from calculateRetainUntil()
  retention_hold BOOLEAN NOT NULL DEFAULT false,                   -- true during HMRC enquiry (TMA 1970 s.20BB — destroying records is criminal)
  retention_flagged BOOLEAN NOT NULL DEFAULT false,               -- set by cron when retain_until has passed
  classification_confidence TEXT NOT NULL DEFAULT 'unclassified'
    CHECK (classification_confidence IN ('high', 'medium', 'low', 'unclassified')),
  source TEXT NOT NULL CHECK (source IN ('inbound_email', 'portal_upload', 'manual')),
  uploader_user_id UUID,                                           -- null for inbound_email source
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_documents_select_org"
ON client_documents FOR SELECT TO authenticated
USING (org_id = auth_org_id());

CREATE POLICY "client_documents_insert_org"
ON client_documents FOR INSERT TO authenticated
WITH CHECK (org_id = auth_org_id());

CREATE POLICY "client_documents_update_org"
ON client_documents FOR UPDATE TO authenticated
USING (org_id = auth_org_id());

CREATE POLICY "client_documents_delete_org"
ON client_documents FOR DELETE TO authenticated
USING (org_id = auth_org_id());

CREATE POLICY "client_documents_service_role_all"
ON client_documents FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Indexes for client_documents
CREATE INDEX idx_client_documents_org_id ON client_documents(org_id);
CREATE INDEX idx_client_documents_client_id ON client_documents(client_id);
CREATE INDEX idx_client_documents_filing_type ON client_documents(filing_type_id);
-- Partial index: retention cron only needs rows where retention_hold is false
CREATE INDEX idx_client_documents_retain_until ON client_documents(retain_until)
  WHERE NOT retention_hold;

-- ============================================================================
-- 4. document_access_log
-- Org-scoped audit log — INSERT-only for authenticated (no UPDATE/DELETE)
-- Audit trail integrity: authenticated users can never modify or delete log entries
-- ============================================================================

CREATE TABLE document_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id),
  document_id UUID NOT NULL REFERENCES client_documents(id) ON DELETE CASCADE,
  user_id UUID,                                                    -- nullable (null for portal access if portal user is unauthenticated)
  action TEXT NOT NULL CHECK (action IN ('view', 'download', 'delete')),
  session_context TEXT,                                            -- optional: IP summary, user agent
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE document_access_log ENABLE ROW LEVEL SECURITY;

-- INSERT-only for authenticated (audit trail integrity — no UPDATE or DELETE via RLS)
CREATE POLICY "document_access_log_insert_org"
ON document_access_log FOR INSERT TO authenticated
WITH CHECK (org_id = auth_org_id());

-- SELECT: org members can read their own org's audit log
CREATE POLICY "document_access_log_select_org"
ON document_access_log FOR SELECT TO authenticated
USING (org_id = auth_org_id());

-- NO UPDATE or DELETE policies for authenticated role
-- Only service_role can UPDATE or DELETE (admin operations only)
CREATE POLICY "document_access_log_service_role_all"
ON document_access_log FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Indexes for document_access_log
CREATE INDEX idx_document_access_log_org_id ON document_access_log(org_id);
CREATE INDEX idx_document_access_log_document_id ON document_access_log(document_id);
CREATE INDEX idx_document_access_log_created_at ON document_access_log(created_at DESC);

-- ============================================================================
-- 5. upload_portal_tokens
-- Org-scoped; stores SHA-256 hash of portal token (raw token never stored)
-- 256-bit entropy via crypto.randomBytes(32); multi-use until expires_at
-- ============================================================================

CREATE TABLE upload_portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  filing_type_id TEXT NOT NULL REFERENCES filing_types(id),
  tax_year TEXT NOT NULL,                                          -- e.g. '2024-25' for SA100, '2025' for company filings
  token_hash TEXT NOT NULL UNIQUE,                                 -- SHA-256 hex of raw token (raw token NEVER stored)
  expires_at TIMESTAMPTZ NOT NULL,                                 -- set by app to now() + interval '7 days'
  used_at TIMESTAMPTZ,                                             -- last-use timestamp (nullable; updated on each use)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID                                          -- accountant who generated the link (nullable)
);

ALTER TABLE upload_portal_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "upload_portal_tokens_select_org"
ON upload_portal_tokens FOR SELECT TO authenticated
USING (org_id = auth_org_id());

CREATE POLICY "upload_portal_tokens_insert_org"
ON upload_portal_tokens FOR INSERT TO authenticated
WITH CHECK (org_id = auth_org_id());

CREATE POLICY "upload_portal_tokens_update_org"
ON upload_portal_tokens FOR UPDATE TO authenticated
USING (org_id = auth_org_id());

CREATE POLICY "upload_portal_tokens_delete_org"
ON upload_portal_tokens FOR DELETE TO authenticated
USING (org_id = auth_org_id());

CREATE POLICY "upload_portal_tokens_service_role_all"
ON upload_portal_tokens FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Indexes for upload_portal_tokens
CREATE INDEX idx_upload_portal_tokens_org_id ON upload_portal_tokens(org_id);
CREATE INDEX idx_upload_portal_tokens_token_hash ON upload_portal_tokens(token_hash);
-- Composite index for accountant "view active tokens for client" query
CREATE INDEX idx_upload_portal_tokens_client_filing
  ON upload_portal_tokens(client_id, filing_type_id, tax_year);
