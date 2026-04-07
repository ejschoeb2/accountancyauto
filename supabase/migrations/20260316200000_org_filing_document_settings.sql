-- Downtime risk: NONE — safe for zero-downtime deployment
-- Org-level document requirement settings
-- Allows orgs to configure which document types are enabled for each filing type
-- If no row exists for a given (org, filing_type, document_type), the default is enabled.

CREATE TABLE IF NOT EXISTS org_filing_document_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  filing_type_id TEXT NOT NULL REFERENCES filing_types(id) ON DELETE CASCADE,
  document_type_id UUID NOT NULL REFERENCES document_types(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, filing_type_id, document_type_id)
);

-- RLS
ALTER TABLE org_filing_document_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org document settings"
  ON org_filing_document_settings FOR SELECT
  USING (org_id = (SELECT (raw_app_meta_data ->> 'org_id')::uuid FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Users can manage their org document settings"
  ON org_filing_document_settings FOR ALL
  USING (org_id = (SELECT (raw_app_meta_data ->> 'org_id')::uuid FROM auth.users WHERE id = auth.uid()));
