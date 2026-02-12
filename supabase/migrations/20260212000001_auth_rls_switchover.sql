-- Auth RLS Switchover: Drop all anon policies, ensure authenticated + service_role exist on all tables.
-- After this migration, unauthenticated requests via the anon key can read/write NOTHING.
-- Cron jobs and webhooks use createAdminClient() (service_role), so they are unaffected.
-- The regular server client (lib/supabase/server.ts) uses the anon key, but when a user is
-- authenticated via Supabase Auth, PostgREST automatically elevates to the 'authenticated' role.

-- Step 1: Add authenticated policies where missing (before dropping anon)

-- app_settings: add authenticated policies (currently anon-only)
CREATE POLICY "Authenticated users can read app_settings" ON app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update app_settings" ON app_settings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can insert app_settings" ON app_settings
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Service role full access to app_settings" ON app_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- schedule_client_exclusions: add authenticated + service_role
CREATE POLICY "Authenticated users full access to schedule_client_exclusions" ON schedule_client_exclusions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to schedule_client_exclusions" ON schedule_client_exclusions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Step 2: Drop ALL anon policies across all tables

-- Phase 1: clients (from 20260207131000)
DROP POLICY IF EXISTS "Anon users can read clients" ON clients;
DROP POLICY IF EXISTS "Anon users can insert clients" ON clients;
DROP POLICY IF EXISTS "Anon users can update clients" ON clients;

-- Phase 2: (from 20260207193244)
DROP POLICY IF EXISTS "Anon users can read filing_types" ON filing_types;
DROP POLICY IF EXISTS "Anon users can read client_filing_assignments" ON client_filing_assignments;
DROP POLICY IF EXISTS "Anon users can modify client_filing_assignments" ON client_filing_assignments;
DROP POLICY IF EXISTS "Anon users can read client_deadline_overrides" ON client_deadline_overrides;
DROP POLICY IF EXISTS "Anon users can modify client_deadline_overrides" ON client_deadline_overrides;
DROP POLICY IF EXISTS "Anon users can read reminder_templates" ON reminder_templates;
DROP POLICY IF EXISTS "Anon users can modify reminder_templates" ON reminder_templates;  -- from 20260207194239
DROP POLICY IF EXISTS "Anon users can read client_template_overrides" ON client_template_overrides;
DROP POLICY IF EXISTS "Anon users can modify client_template_overrides" ON client_template_overrides;
DROP POLICY IF EXISTS "Anon users can read bank_holidays_cache" ON bank_holidays_cache;
DROP POLICY IF EXISTS "Anon users can modify bank_holidays_cache" ON bank_holidays_cache;
DROP POLICY IF EXISTS "Anon users can read reminder_queue" ON reminder_queue;
DROP POLICY IF EXISTS "Anon users can modify reminder_queue" ON reminder_queue;
DROP POLICY IF EXISTS "Anon users can read email_log" ON email_log;
DROP POLICY IF EXISTS "Anon users can modify email_log" ON email_log;

-- v1.1 tables (from 20260208000001)
DROP POLICY IF EXISTS "Anon users can read email_templates" ON email_templates;
DROP POLICY IF EXISTS "Anon users can modify email_templates" ON email_templates;
DROP POLICY IF EXISTS "Anon users can read schedules" ON schedules;
DROP POLICY IF EXISTS "Anon users can modify schedules" ON schedules;
DROP POLICY IF EXISTS "Anon users can read schedule_steps" ON schedule_steps;
DROP POLICY IF EXISTS "Anon users can modify schedule_steps" ON schedule_steps;
DROP POLICY IF EXISTS "Anon users can read client_email_overrides" ON client_email_overrides;
DROP POLICY IF EXISTS "Anon users can modify client_email_overrides" ON client_email_overrides;
DROP POLICY IF EXISTS "Anon users can read client_schedule_overrides" ON client_schedule_overrides;
DROP POLICY IF EXISTS "Anon users can modify client_schedule_overrides" ON client_schedule_overrides;

-- app_settings (from 20260209120000 and 20260209230000)
DROP POLICY IF EXISTS "Anon users can read app_settings" ON app_settings;
DROP POLICY IF EXISTS "Anon users can update app_settings" ON app_settings;
DROP POLICY IF EXISTS "Anon users can insert app_settings" ON app_settings;

-- schedule_client_exclusions (from 20260209210000)
DROP POLICY IF EXISTS "Allow anon full access to schedule_client_exclusions" ON schedule_client_exclusions;
