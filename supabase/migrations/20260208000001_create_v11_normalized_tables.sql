-- Phase 4: v1.1 Normalized Tables
-- Restructures JSONB-embedded templates into normalized email_templates,
-- schedules, schedule_steps, and per-client override tables.
-- Old tables (reminder_templates, client_template_overrides) are NOT modified.

-- ============================================================================
-- TABLE 1: Email Templates (standalone, reusable email content)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_json JSONB NOT NULL,
  body_plain TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- TABLE 2: Schedules (one per filing type, replaces reminder_templates role)
-- ============================================================================

CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filing_type_id TEXT REFERENCES filing_types(id) ON DELETE CASCADE UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER schedules_updated_at
  BEFORE UPDATE ON schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- TABLE 3: Schedule Steps (ordered steps within a schedule)
-- ============================================================================

CREATE TABLE IF NOT EXISTS schedule_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE NOT NULL,
  email_template_id UUID REFERENCES email_templates(id) ON DELETE RESTRICT NOT NULL,
  step_number INT NOT NULL,
  delay_days INT NOT NULL,
  urgency_level TEXT NOT NULL DEFAULT 'normal' CHECK (urgency_level IN ('low', 'normal', 'high', 'urgent')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(schedule_id, step_number)
);

-- ============================================================================
-- TABLE 4: Client Email Overrides (per-client content customizations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_email_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  email_template_id UUID REFERENCES email_templates(id) ON DELETE CASCADE NOT NULL,
  subject_override TEXT,
  body_json_override JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, email_template_id)
);

CREATE TRIGGER client_email_overrides_updated_at
  BEFORE UPDATE ON client_email_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- TABLE 5: Client Schedule Overrides (per-client timing customizations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_schedule_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  schedule_step_id UUID REFERENCES schedule_steps(id) ON DELETE CASCADE NOT NULL,
  delay_days_override INT,
  is_skipped BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, schedule_step_id)
);

CREATE TRIGGER client_schedule_overrides_updated_at
  BEFORE UPDATE ON client_schedule_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- INDEXES: Query optimization
-- ============================================================================

CREATE INDEX idx_schedule_steps_schedule ON schedule_steps(schedule_id);
CREATE INDEX idx_schedule_steps_template ON schedule_steps(email_template_id);
CREATE INDEX idx_client_email_overrides_client ON client_email_overrides(client_id);
CREATE INDEX idx_client_email_overrides_template ON client_email_overrides(email_template_id);
CREATE INDEX idx_client_schedule_overrides_client ON client_schedule_overrides(client_id);
CREATE INDEX idx_client_schedule_overrides_step ON client_schedule_overrides(schedule_step_id);

-- ============================================================================
-- RLS POLICIES: Row-level security for v1.1 tables
-- ============================================================================

-- Enable RLS on all 5 tables
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_email_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_schedule_overrides ENABLE ROW LEVEL SECURITY;

-- email_templates: authenticated
CREATE POLICY "Authenticated users can read email_templates" ON email_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify email_templates" ON email_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- email_templates: service_role
CREATE POLICY "Service role full access to email_templates" ON email_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- email_templates: anon
CREATE POLICY "Anon users can read email_templates" ON email_templates
  FOR SELECT TO anon USING (true);
CREATE POLICY "Anon users can modify email_templates" ON email_templates
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- schedules: authenticated
CREATE POLICY "Authenticated users can read schedules" ON schedules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify schedules" ON schedules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- schedules: service_role
CREATE POLICY "Service role full access to schedules" ON schedules
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- schedules: anon
CREATE POLICY "Anon users can read schedules" ON schedules
  FOR SELECT TO anon USING (true);
CREATE POLICY "Anon users can modify schedules" ON schedules
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- schedule_steps: authenticated
CREATE POLICY "Authenticated users can read schedule_steps" ON schedule_steps
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify schedule_steps" ON schedule_steps
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- schedule_steps: service_role
CREATE POLICY "Service role full access to schedule_steps" ON schedule_steps
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- schedule_steps: anon
CREATE POLICY "Anon users can read schedule_steps" ON schedule_steps
  FOR SELECT TO anon USING (true);
CREATE POLICY "Anon users can modify schedule_steps" ON schedule_steps
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- client_email_overrides: authenticated
CREATE POLICY "Authenticated users can read client_email_overrides" ON client_email_overrides
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify client_email_overrides" ON client_email_overrides
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- client_email_overrides: service_role
CREATE POLICY "Service role full access to client_email_overrides" ON client_email_overrides
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- client_email_overrides: anon
CREATE POLICY "Anon users can read client_email_overrides" ON client_email_overrides
  FOR SELECT TO anon USING (true);
CREATE POLICY "Anon users can modify client_email_overrides" ON client_email_overrides
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- client_schedule_overrides: authenticated
CREATE POLICY "Authenticated users can read client_schedule_overrides" ON client_schedule_overrides
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify client_schedule_overrides" ON client_schedule_overrides
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- client_schedule_overrides: service_role
CREATE POLICY "Service role full access to client_schedule_overrides" ON client_schedule_overrides
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- client_schedule_overrides: anon
CREATE POLICY "Anon users can read client_schedule_overrides" ON client_schedule_overrides
  FOR SELECT TO anon USING (true);
CREATE POLICY "Anon users can modify client_schedule_overrides" ON client_schedule_overrides
  FOR ALL TO anon USING (true) WITH CHECK (true);
