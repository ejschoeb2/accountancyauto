-- Phase 2: Reminder Engine Schema
-- Creates filing types, templates, assignments, overrides, queue, and bank holiday cache

-- ============================================================================
-- REFERENCE TABLE: Filing Types
-- ============================================================================

CREATE TABLE IF NOT EXISTS filing_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  applicable_client_types client_type_enum[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed filing types (idempotent)
INSERT INTO filing_types (id, name, description, applicable_client_types) VALUES
  ('corporation_tax_payment', 'Corporation Tax Payment', 'Corporation tax payment deadline', ARRAY['Limited Company', 'LLP']::client_type_enum[]),
  ('ct600_filing', 'CT600 Filing', 'Corporation tax return filing deadline', ARRAY['Limited Company', 'LLP']::client_type_enum[]),
  ('companies_house', 'Companies House Accounts', 'Annual accounts filing at Companies House', ARRAY['Limited Company', 'LLP']::client_type_enum[]),
  ('vat_return', 'VAT Return', 'VAT return submission and payment', ARRAY['Limited Company', 'Sole Trader', 'Partnership', 'LLP']::client_type_enum[]),
  ('self_assessment', 'Self Assessment', 'Self assessment tax return', ARRAY['Sole Trader', 'Partnership']::client_type_enum[])
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- TEMPLATES: Multi-step reminder sequences
-- ============================================================================

CREATE TABLE IF NOT EXISTS reminder_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filing_type_id TEXT REFERENCES filing_types(id) ON DELETE CASCADE UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]', -- Array of {step_number, delay_days, subject, body}
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- CLIENT CONFIGURATION: Which filings apply to each client
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_filing_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  filing_type_id TEXT REFERENCES filing_types(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, filing_type_id)
);

-- ============================================================================
-- OVERRIDES: Per-client deadline date overrides
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_deadline_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  filing_type_id TEXT REFERENCES filing_types(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, filing_type_id)
);

-- ============================================================================
-- OVERRIDES: Per-client template step customizations
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_template_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  template_id UUID REFERENCES reminder_templates(id) ON DELETE CASCADE,
  step_index INT NOT NULL,
  overridden_fields JSONB NOT NULL, -- {subject?, body?, delay_days?}
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, template_id, step_index)
);

-- ============================================================================
-- BANK HOLIDAYS CACHE: Gov.uk bank holiday data
-- ============================================================================

CREATE TABLE IF NOT EXISTS bank_holidays_cache (
  id SERIAL PRIMARY KEY,
  holiday_date DATE NOT NULL UNIQUE,
  title TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'england-and-wales',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- REMINDER QUEUE: Scheduled/pending reminders for cron processing
-- ============================================================================

CREATE TABLE IF NOT EXISTS reminder_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  filing_type_id TEXT REFERENCES filing_types(id) ON DELETE CASCADE,
  template_id UUID REFERENCES reminder_templates(id) ON DELETE SET NULL,
  step_index INT NOT NULL,
  deadline_date DATE NOT NULL,
  send_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'pending', 'sent', 'cancelled', 'failed')),
  resolved_subject TEXT,
  resolved_body TEXT,
  queued_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES: Query optimization
-- ============================================================================

CREATE INDEX idx_reminder_queue_send_date_status ON reminder_queue(send_date, status);
CREATE INDEX idx_reminder_queue_client_filing ON reminder_queue(client_id, filing_type_id);
CREATE INDEX idx_client_filing_assignments_client ON client_filing_assignments(client_id);
CREATE INDEX idx_client_template_overrides_client ON client_template_overrides(client_id);
CREATE INDEX idx_client_deadline_overrides_client ON client_deadline_overrides(client_id);

-- ============================================================================
-- EXTEND EXISTING CLIENTS TABLE: Add Phase 2 metadata columns
-- ============================================================================

ALTER TABLE clients ADD COLUMN IF NOT EXISTS has_overrides BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS reminders_paused BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS records_received_for JSONB DEFAULT '[]';

-- ============================================================================
-- TRIGGERS: Auto-update timestamps
-- ============================================================================

CREATE TRIGGER reminder_templates_updated_at
  BEFORE UPDATE ON reminder_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER client_deadline_overrides_updated_at
  BEFORE UPDATE ON client_deadline_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER client_template_overrides_updated_at
  BEFORE UPDATE ON client_template_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER reminder_queue_updated_at
  BEFORE UPDATE ON reminder_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- TRIGGER: Auto-update has_overrides flag on clients
-- ============================================================================

CREATE OR REPLACE FUNCTION update_client_has_overrides()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT or UPDATE, set has_overrides = true for this client
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    UPDATE clients SET has_overrides = true WHERE id = NEW.client_id;
    RETURN NEW;
  END IF;

  -- On DELETE, check if any overrides remain for this client
  IF (TG_OP = 'DELETE') THEN
    UPDATE clients
    SET has_overrides = EXISTS(
      SELECT 1 FROM client_template_overrides WHERE client_id = OLD.client_id
    )
    WHERE id = OLD.client_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER client_template_overrides_update_flag
  AFTER INSERT OR UPDATE OR DELETE ON client_template_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_client_has_overrides();

-- ============================================================================
-- RLS POLICIES: Row-level security for Phase 2 tables
-- ============================================================================

ALTER TABLE filing_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_filing_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_deadline_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_template_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_holidays_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_queue ENABLE ROW LEVEL SECURITY;

-- Authenticated users: full CRUD
CREATE POLICY "Authenticated users can read filing_types" ON filing_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify filing_types" ON filing_types
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read reminder_templates" ON reminder_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify reminder_templates" ON reminder_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read client_filing_assignments" ON client_filing_assignments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify client_filing_assignments" ON client_filing_assignments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read client_deadline_overrides" ON client_deadline_overrides
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify client_deadline_overrides" ON client_deadline_overrides
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read client_template_overrides" ON client_template_overrides
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify client_template_overrides" ON client_template_overrides
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read bank_holidays_cache" ON bank_holidays_cache
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify bank_holidays_cache" ON bank_holidays_cache
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read reminder_queue" ON reminder_queue
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify reminder_queue" ON reminder_queue
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Service role: full access for background jobs
CREATE POLICY "Service role full access to filing_types" ON filing_types
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to reminder_templates" ON reminder_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to client_filing_assignments" ON client_filing_assignments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to client_deadline_overrides" ON client_deadline_overrides
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to client_template_overrides" ON client_template_overrides
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to bank_holidays_cache" ON bank_holidays_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to reminder_queue" ON reminder_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);
