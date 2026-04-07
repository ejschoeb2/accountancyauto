-- Downtime risk: NONE — safe for zero-downtime deployment
-- Phase 10 Plan 02: Org-Scoped RLS Policies
-- Migration 2/2: Replace all USING(true) authenticated policies with org_id scoping
--
-- This migration:
-- 1. Drops ALL existing authenticated policies on data tables
-- 2. Creates org-scoped policies using auth_org_id() helper (from migration 20260219000004)
-- 3. Keeps service_role policies unchanged (cron jobs need full cross-org access)
-- 4. Keeps filing_types and bank_holidays_cache globally readable (no org_id)
-- 5. Adds org-scoped policies to organisations, user_organisations, invitations
--
-- After this migration, every authenticated query is automatically filtered to the
-- user's org. Cross-tenant data access is impossible.

-- ============================================================================
-- GROUP 1: CORE DATA TABLES (6 tables)
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE: clients
-- Drop: "Authenticated users can read clients" (SELECT)
-- Drop: "Authenticated users can insert clients" (INSERT)
-- Drop: "Authenticated users can update clients" (UPDATE)
-- Keep: "Service role full access to clients"
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON clients;

CREATE POLICY "clients_select_org" ON clients
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id());

CREATE POLICY "clients_insert_org" ON clients
  FOR INSERT TO authenticated
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "clients_update_org" ON clients
  FOR UPDATE TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "clients_delete_org" ON clients
  FOR DELETE TO authenticated
  USING (org_id = auth_org_id());

-- --------------------------------------------------------------------------
-- TABLE: email_templates
-- Drop: "Authenticated users can read email_templates" (SELECT)
-- Drop: "Authenticated users can modify email_templates" (ALL)
-- Keep: "Service role full access to email_templates"
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read email_templates" ON email_templates;
DROP POLICY IF EXISTS "Authenticated users can modify email_templates" ON email_templates;

CREATE POLICY "email_templates_select_org" ON email_templates
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id());

CREATE POLICY "email_templates_insert_org" ON email_templates
  FOR INSERT TO authenticated
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "email_templates_update_org" ON email_templates
  FOR UPDATE TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "email_templates_delete_org" ON email_templates
  FOR DELETE TO authenticated
  USING (org_id = auth_org_id());

-- --------------------------------------------------------------------------
-- TABLE: schedules
-- Drop: "Authenticated users can read schedules" (SELECT)
-- Drop: "Authenticated users can modify schedules" (ALL)
-- Keep: "Service role full access to schedules"
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read schedules" ON schedules;
DROP POLICY IF EXISTS "Authenticated users can modify schedules" ON schedules;

CREATE POLICY "schedules_select_org" ON schedules
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id());

CREATE POLICY "schedules_insert_org" ON schedules
  FOR INSERT TO authenticated
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "schedules_update_org" ON schedules
  FOR UPDATE TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "schedules_delete_org" ON schedules
  FOR DELETE TO authenticated
  USING (org_id = auth_org_id());

-- --------------------------------------------------------------------------
-- TABLE: schedule_steps
-- Drop: "Authenticated users can read schedule_steps" (SELECT)
-- Drop: "Authenticated users can modify schedule_steps" (ALL)
-- Keep: "Service role full access to schedule_steps"
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read schedule_steps" ON schedule_steps;
DROP POLICY IF EXISTS "Authenticated users can modify schedule_steps" ON schedule_steps;

CREATE POLICY "schedule_steps_select_org" ON schedule_steps
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id());

CREATE POLICY "schedule_steps_insert_org" ON schedule_steps
  FOR INSERT TO authenticated
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "schedule_steps_update_org" ON schedule_steps
  FOR UPDATE TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "schedule_steps_delete_org" ON schedule_steps
  FOR DELETE TO authenticated
  USING (org_id = auth_org_id());

-- --------------------------------------------------------------------------
-- TABLE: client_filing_assignments
-- Drop: "Authenticated users can read client_filing_assignments" (SELECT)
-- Drop: "Authenticated users can modify client_filing_assignments" (ALL)
-- Keep: "Service role full access to client_filing_assignments"
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read client_filing_assignments" ON client_filing_assignments;
DROP POLICY IF EXISTS "Authenticated users can modify client_filing_assignments" ON client_filing_assignments;

CREATE POLICY "client_filing_assignments_select_org" ON client_filing_assignments
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id());

CREATE POLICY "client_filing_assignments_insert_org" ON client_filing_assignments
  FOR INSERT TO authenticated
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "client_filing_assignments_update_org" ON client_filing_assignments
  FOR UPDATE TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "client_filing_assignments_delete_org" ON client_filing_assignments
  FOR DELETE TO authenticated
  USING (org_id = auth_org_id());

-- --------------------------------------------------------------------------
-- TABLE: client_deadline_overrides
-- Drop: "Authenticated users can read client_deadline_overrides" (SELECT)
-- Drop: "Authenticated users can modify client_deadline_overrides" (ALL)
-- Keep: "Service role full access to client_deadline_overrides"
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read client_deadline_overrides" ON client_deadline_overrides;
DROP POLICY IF EXISTS "Authenticated users can modify client_deadline_overrides" ON client_deadline_overrides;

CREATE POLICY "client_deadline_overrides_select_org" ON client_deadline_overrides
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id());

CREATE POLICY "client_deadline_overrides_insert_org" ON client_deadline_overrides
  FOR INSERT TO authenticated
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "client_deadline_overrides_update_org" ON client_deadline_overrides
  FOR UPDATE TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "client_deadline_overrides_delete_org" ON client_deadline_overrides
  FOR DELETE TO authenticated
  USING (org_id = auth_org_id());

-- ============================================================================
-- GROUP 2: SECONDARY DATA TABLES (7 tables)
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE: schedule_client_exclusions
-- Drop: "Authenticated users full access to schedule_client_exclusions" (ALL)
-- Keep: "Service role full access to schedule_client_exclusions"
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users full access to schedule_client_exclusions" ON schedule_client_exclusions;

CREATE POLICY "schedule_client_exclusions_select_org" ON schedule_client_exclusions
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id());

CREATE POLICY "schedule_client_exclusions_insert_org" ON schedule_client_exclusions
  FOR INSERT TO authenticated
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "schedule_client_exclusions_update_org" ON schedule_client_exclusions
  FOR UPDATE TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "schedule_client_exclusions_delete_org" ON schedule_client_exclusions
  FOR DELETE TO authenticated
  USING (org_id = auth_org_id());

-- --------------------------------------------------------------------------
-- TABLE: client_email_overrides
-- Drop: "Authenticated users can read client_email_overrides" (SELECT)
-- Drop: "Authenticated users can modify client_email_overrides" (ALL)
-- Keep: "Service role full access to client_email_overrides"
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read client_email_overrides" ON client_email_overrides;
DROP POLICY IF EXISTS "Authenticated users can modify client_email_overrides" ON client_email_overrides;

CREATE POLICY "client_email_overrides_select_org" ON client_email_overrides
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id());

CREATE POLICY "client_email_overrides_insert_org" ON client_email_overrides
  FOR INSERT TO authenticated
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "client_email_overrides_update_org" ON client_email_overrides
  FOR UPDATE TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "client_email_overrides_delete_org" ON client_email_overrides
  FOR DELETE TO authenticated
  USING (org_id = auth_org_id());

-- --------------------------------------------------------------------------
-- TABLE: client_schedule_overrides
-- Drop: "Authenticated users can read client_schedule_overrides" (SELECT)
-- Drop: "Authenticated users can modify client_schedule_overrides" (ALL)
-- Keep: "Service role full access to client_schedule_overrides"
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read client_schedule_overrides" ON client_schedule_overrides;
DROP POLICY IF EXISTS "Authenticated users can modify client_schedule_overrides" ON client_schedule_overrides;

CREATE POLICY "client_schedule_overrides_select_org" ON client_schedule_overrides
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id());

CREATE POLICY "client_schedule_overrides_insert_org" ON client_schedule_overrides
  FOR INSERT TO authenticated
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "client_schedule_overrides_update_org" ON client_schedule_overrides
  FOR UPDATE TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "client_schedule_overrides_delete_org" ON client_schedule_overrides
  FOR DELETE TO authenticated
  USING (org_id = auth_org_id());

-- --------------------------------------------------------------------------
-- TABLE: client_filing_status_overrides
-- Drop: "Authenticated users can manage status overrides" (ALL)
-- Keep: "Service role full access to status overrides"
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can manage status overrides" ON client_filing_status_overrides;

CREATE POLICY "client_filing_status_overrides_select_org" ON client_filing_status_overrides
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id());

CREATE POLICY "client_filing_status_overrides_insert_org" ON client_filing_status_overrides
  FOR INSERT TO authenticated
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "client_filing_status_overrides_update_org" ON client_filing_status_overrides
  FOR UPDATE TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "client_filing_status_overrides_delete_org" ON client_filing_status_overrides
  FOR DELETE TO authenticated
  USING (org_id = auth_org_id());

-- --------------------------------------------------------------------------
-- TABLE: reminder_queue
-- Drop: "Authenticated users can read reminder_queue" (SELECT)
-- Drop: "Authenticated users can modify reminder_queue" (ALL)
-- Keep: "Service role full access to reminder_queue"
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read reminder_queue" ON reminder_queue;
DROP POLICY IF EXISTS "Authenticated users can modify reminder_queue" ON reminder_queue;

CREATE POLICY "reminder_queue_select_org" ON reminder_queue
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id());

CREATE POLICY "reminder_queue_insert_org" ON reminder_queue
  FOR INSERT TO authenticated
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "reminder_queue_update_org" ON reminder_queue
  FOR UPDATE TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "reminder_queue_delete_org" ON reminder_queue
  FOR DELETE TO authenticated
  USING (org_id = auth_org_id());

-- --------------------------------------------------------------------------
-- TABLE: email_log
-- Drop: "Authenticated users can read email_log" (SELECT)
-- Drop: "Authenticated users can modify email_log" (ALL)
-- Keep: "Service role full access to email_log"
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read email_log" ON email_log;
DROP POLICY IF EXISTS "Authenticated users can modify email_log" ON email_log;

CREATE POLICY "email_log_select_org" ON email_log
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id());

CREATE POLICY "email_log_insert_org" ON email_log
  FOR INSERT TO authenticated
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "email_log_update_org" ON email_log
  FOR UPDATE TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "email_log_delete_org" ON email_log
  FOR DELETE TO authenticated
  USING (org_id = auth_org_id());

-- --------------------------------------------------------------------------
-- TABLE: inbound_emails
-- Drop: "Authenticated users can read inbound_emails" (SELECT)
-- Drop: "Authenticated users can insert inbound_emails" (INSERT)
-- Drop: "Authenticated users can update inbound_emails" (UPDATE)
-- Drop: "Authenticated users can delete inbound_emails" (DELETE)
-- Keep: "Service role full access to inbound_emails"
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read inbound_emails" ON inbound_emails;
DROP POLICY IF EXISTS "Authenticated users can insert inbound_emails" ON inbound_emails;
DROP POLICY IF EXISTS "Authenticated users can update inbound_emails" ON inbound_emails;
DROP POLICY IF EXISTS "Authenticated users can delete inbound_emails" ON inbound_emails;

CREATE POLICY "inbound_emails_select_org" ON inbound_emails
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id());

CREATE POLICY "inbound_emails_insert_org" ON inbound_emails
  FOR INSERT TO authenticated
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "inbound_emails_update_org" ON inbound_emails
  FOR UPDATE TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "inbound_emails_delete_org" ON inbound_emails
  FOR DELETE TO authenticated
  USING (org_id = auth_org_id());

-- ============================================================================
-- GROUP 3: SYSTEM TABLES (2 tables)
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE: app_settings
-- Drop: "Authenticated users can read app_settings" (SELECT)
-- Drop: "Authenticated users can update app_settings" (UPDATE)
-- Drop: "Authenticated users can insert app_settings" (INSERT)
-- Keep: "Service role full access to app_settings"
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read app_settings" ON app_settings;
DROP POLICY IF EXISTS "Authenticated users can update app_settings" ON app_settings;
DROP POLICY IF EXISTS "Authenticated users can insert app_settings" ON app_settings;

CREATE POLICY "app_settings_select_org" ON app_settings
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id());

CREATE POLICY "app_settings_insert_org" ON app_settings
  FOR INSERT TO authenticated
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "app_settings_update_org" ON app_settings
  FOR UPDATE TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "app_settings_delete_org" ON app_settings
  FOR DELETE TO authenticated
  USING (org_id = auth_org_id());

-- --------------------------------------------------------------------------
-- TABLE: locks
-- Drop: "Authenticated users can manage locks" (ALL)
-- Keep: "Service role full access to locks"
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can manage locks" ON locks;

CREATE POLICY "locks_select_org" ON locks
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id());

CREATE POLICY "locks_insert_org" ON locks
  FOR INSERT TO authenticated
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "locks_update_org" ON locks
  FOR UPDATE TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "locks_delete_org" ON locks
  FOR DELETE TO authenticated
  USING (org_id = auth_org_id());

-- ============================================================================
-- SPECIAL: MULTI-TENANT TABLES (org-scoped but different patterns)
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE: organisations
-- Users can only SELECT their own org (by org id = their JWT org_id)
-- Drop: "Authenticated users can read organisations" (SELECT with USING(true))
-- Keep: "Service role full access to organisations"
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read organisations" ON organisations;

CREATE POLICY "organisations_select_own" ON organisations
  FOR SELECT TO authenticated
  USING (id = auth_org_id());

-- No INSERT/UPDATE/DELETE for authenticated users on organisations.
-- Org management (name changes, plan upgrades) goes through service_role API routes.

-- --------------------------------------------------------------------------
-- TABLE: user_organisations
-- Users can only see members of their own org
-- Drop: "Authenticated users can manage user_organisations" (ALL with USING(true))
-- Keep: "Service role full access to user_organisations"
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can manage user_organisations" ON user_organisations;

CREATE POLICY "user_organisations_select_org" ON user_organisations
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id());

-- No INSERT/UPDATE/DELETE for authenticated on user_organisations.
-- Member management (invite accept, role changes) goes through service_role API routes.

-- --------------------------------------------------------------------------
-- TABLE: invitations
-- Users can manage invitations for their own org
-- Drop: "Authenticated users can manage invitations" (ALL with USING(true))
-- Keep: "Service role full access to invitations"
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can manage invitations" ON invitations;

CREATE POLICY "invitations_select_org" ON invitations
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id());

CREATE POLICY "invitations_insert_org" ON invitations
  FOR INSERT TO authenticated
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "invitations_update_org" ON invitations
  FOR UPDATE TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "invitations_delete_org" ON invitations
  FOR DELETE TO authenticated
  USING (org_id = auth_org_id());

-- ============================================================================
-- GLOBAL REFERENCE TABLES (no org_id — keep globally readable)
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE: filing_types
-- Keep globally readable by all authenticated users.
-- Remove write access for authenticated (reference data managed by service_role).
-- Drop: "Authenticated users can modify filing_types" (ALL — includes write ops)
-- Keep: "Authenticated users can read filing_types" (SELECT with USING(true))
-- Keep: "Service role full access to filing_types"
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can modify filing_types" ON filing_types;
-- "Authenticated users can read filing_types" stays — USING(true) SELECT is correct

-- --------------------------------------------------------------------------
-- TABLE: bank_holidays_cache
-- Keep globally readable by all authenticated users.
-- Remove write access for authenticated (reference data managed by service_role).
-- Drop: "Authenticated users can modify bank_holidays_cache" (ALL — includes write ops)
-- Keep: "Authenticated users can read bank_holidays_cache" (SELECT with USING(true))
-- Keep: "Service role full access to bank_holidays_cache"
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can modify bank_holidays_cache" ON bank_holidays_cache;
-- "Authenticated users can read bank_holidays_cache" stays — USING(true) SELECT is correct

-- ============================================================================
-- CLEANUP: Drop all remaining anon policies on data tables
-- These should have been removed by 20260212000001_auth_rls_switchover.sql
-- but were re-created due to migration re-ordering with --include-all.
-- Anon users should have zero access to any data.
-- ============================================================================

-- clients
DROP POLICY IF EXISTS "Anon users can read clients" ON clients;
DROP POLICY IF EXISTS "Anon users can insert clients" ON clients;
DROP POLICY IF EXISTS "Anon users can update clients" ON clients;

-- email_templates
DROP POLICY IF EXISTS "Anon users can read email_templates" ON email_templates;
DROP POLICY IF EXISTS "Anon users can modify email_templates" ON email_templates;

-- schedules
DROP POLICY IF EXISTS "Anon users can read schedules" ON schedules;
DROP POLICY IF EXISTS "Anon users can modify schedules" ON schedules;

-- schedule_steps
DROP POLICY IF EXISTS "Anon users can read schedule_steps" ON schedule_steps;
DROP POLICY IF EXISTS "Anon users can modify schedule_steps" ON schedule_steps;

-- client_filing_assignments
DROP POLICY IF EXISTS "Anon users can read client_filing_assignments" ON client_filing_assignments;
DROP POLICY IF EXISTS "Anon users can modify client_filing_assignments" ON client_filing_assignments;

-- client_deadline_overrides
DROP POLICY IF EXISTS "Anon users can read client_deadline_overrides" ON client_deadline_overrides;
DROP POLICY IF EXISTS "Anon users can modify client_deadline_overrides" ON client_deadline_overrides;

-- client_email_overrides
DROP POLICY IF EXISTS "Anon users can read client_email_overrides" ON client_email_overrides;
DROP POLICY IF EXISTS "Anon users can modify client_email_overrides" ON client_email_overrides;

-- client_schedule_overrides
DROP POLICY IF EXISTS "Anon users can read client_schedule_overrides" ON client_schedule_overrides;
DROP POLICY IF EXISTS "Anon users can modify client_schedule_overrides" ON client_schedule_overrides;

-- schedule_client_exclusions
DROP POLICY IF EXISTS "Allow anon full access to schedule_client_exclusions" ON schedule_client_exclusions;

-- reminder_queue
DROP POLICY IF EXISTS "Anon users can read reminder_queue" ON reminder_queue;
DROP POLICY IF EXISTS "Anon users can modify reminder_queue" ON reminder_queue;

-- email_log
DROP POLICY IF EXISTS "Anon users can read email_log" ON email_log;
DROP POLICY IF EXISTS "Anon users can modify email_log" ON email_log;

-- bank_holidays_cache (anon should not have write access)
DROP POLICY IF EXISTS "Anon users can read bank_holidays_cache" ON bank_holidays_cache;
DROP POLICY IF EXISTS "Anon users can modify bank_holidays_cache" ON bank_holidays_cache;

-- filing_types (anon should not have any access — authenticated SELECT is sufficient)
DROP POLICY IF EXISTS "Anon users can read filing_types" ON filing_types;

-- ============================================================================
-- VALIDATION: Verify no USING(true) authenticated policies remain on data tables
-- ============================================================================

-- This DO block verifies that no permissive USING(true) policies remain on
-- any data table for the authenticated role. If any are found, it raises an error.
DO $$
DECLARE
  bad_policy record;
  bad_count integer := 0;
BEGIN
  FOR bad_policy IN
    SELECT tablename, policyname, cmd, qual
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles::text LIKE '%authenticated%'
      AND (qual::text = 'true' OR qual::text = '(true)')
      AND tablename NOT IN ('filing_types', 'bank_holidays_cache', 'oauth_tokens')
  LOOP
    RAISE WARNING 'REMAINING USING(true) policy: % on % (cmd: %)', bad_policy.policyname, bad_policy.tablename, bad_policy.cmd;
    bad_count := bad_count + 1;
  END LOOP;

  IF bad_count > 0 THEN
    RAISE EXCEPTION 'VALIDATION FAILED: % USING(true) authenticated policies remain on data tables', bad_count;
  END IF;

  RAISE NOTICE 'VALIDATION PASSED: No USING(true) authenticated policies on data tables';
END $$;
