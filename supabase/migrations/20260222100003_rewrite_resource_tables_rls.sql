-- Phase 15 Plan 01: Per-Accountant Configuration
-- Migration 3/3: Rewrite RLS policies for resource tables with owner_id scoping
--
-- Replaces the four org-scoped policies (from 20260219000005) on five tables with
-- role-aware policies that enforce:
--   email_templates, schedules, schedule_steps, schedule_client_exclusions:
--     - Members see only resources where owner_id = auth.uid()
--     - Admins see all resources in the org (org_id scoping only)
--
--   app_settings:
--     - All users in org can read/write (user_id filtering done in application code)
--     - Org-level defaults (user_id IS NULL) must be readable by all members
--     - User-specific overrides must be readable by all (fallback logic in app code)
--
-- IMPORTANT: Service role policies are left unchanged (cron jobs need full access).

-- ============================================================================
-- TABLE: email_templates
-- Drop old org-scoped policies and replace with owner-scoped policies
-- ============================================================================

DROP POLICY IF EXISTS "email_templates_select_org" ON email_templates;
DROP POLICY IF EXISTS "email_templates_insert_org" ON email_templates;
DROP POLICY IF EXISTS "email_templates_update_org" ON email_templates;
DROP POLICY IF EXISTS "email_templates_delete_org" ON email_templates;

-- SELECT: admin sees all in org; member sees only own
CREATE POLICY "email_templates_select_admin" ON email_templates
  FOR SELECT TO authenticated
  USING (
    org_id = auth_org_id()
    AND auth_org_role() = 'admin'
  );

CREATE POLICY "email_templates_select_member" ON email_templates
  FOR SELECT TO authenticated
  USING (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  );

-- INSERT: any authenticated user inserts templates owned by themselves
CREATE POLICY "email_templates_insert_org" ON email_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  );

-- UPDATE: admin updates any in org; member updates only own
CREATE POLICY "email_templates_update_admin" ON email_templates
  FOR UPDATE TO authenticated
  USING (
    org_id = auth_org_id()
    AND auth_org_role() = 'admin'
  )
  WITH CHECK (
    org_id = auth_org_id()
    AND auth_org_role() = 'admin'
  );

CREATE POLICY "email_templates_update_member" ON email_templates
  FOR UPDATE TO authenticated
  USING (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  )
  WITH CHECK (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  );

-- DELETE: admin deletes any in org; member deletes only own
CREATE POLICY "email_templates_delete_admin" ON email_templates
  FOR DELETE TO authenticated
  USING (
    org_id = auth_org_id()
    AND auth_org_role() = 'admin'
  );

CREATE POLICY "email_templates_delete_member" ON email_templates
  FOR DELETE TO authenticated
  USING (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  );

-- ============================================================================
-- TABLE: schedules
-- Drop old org-scoped policies and replace with owner-scoped policies
-- ============================================================================

DROP POLICY IF EXISTS "schedules_select_org" ON schedules;
DROP POLICY IF EXISTS "schedules_insert_org" ON schedules;
DROP POLICY IF EXISTS "schedules_update_org" ON schedules;
DROP POLICY IF EXISTS "schedules_delete_org" ON schedules;

-- SELECT: admin sees all in org; member sees only own
CREATE POLICY "schedules_select_admin" ON schedules
  FOR SELECT TO authenticated
  USING (
    org_id = auth_org_id()
    AND auth_org_role() = 'admin'
  );

CREATE POLICY "schedules_select_member" ON schedules
  FOR SELECT TO authenticated
  USING (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  );

-- INSERT: any authenticated user inserts schedules owned by themselves
CREATE POLICY "schedules_insert_org" ON schedules
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  );

-- UPDATE: admin updates any in org; member updates only own
CREATE POLICY "schedules_update_admin" ON schedules
  FOR UPDATE TO authenticated
  USING (
    org_id = auth_org_id()
    AND auth_org_role() = 'admin'
  )
  WITH CHECK (
    org_id = auth_org_id()
    AND auth_org_role() = 'admin'
  );

CREATE POLICY "schedules_update_member" ON schedules
  FOR UPDATE TO authenticated
  USING (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  )
  WITH CHECK (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  );

-- DELETE: admin deletes any in org; member deletes only own
CREATE POLICY "schedules_delete_admin" ON schedules
  FOR DELETE TO authenticated
  USING (
    org_id = auth_org_id()
    AND auth_org_role() = 'admin'
  );

CREATE POLICY "schedules_delete_member" ON schedules
  FOR DELETE TO authenticated
  USING (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  );

-- ============================================================================
-- TABLE: schedule_steps
-- Drop old org-scoped policies and replace with owner-scoped policies
-- ============================================================================

DROP POLICY IF EXISTS "schedule_steps_select_org" ON schedule_steps;
DROP POLICY IF EXISTS "schedule_steps_insert_org" ON schedule_steps;
DROP POLICY IF EXISTS "schedule_steps_update_org" ON schedule_steps;
DROP POLICY IF EXISTS "schedule_steps_delete_org" ON schedule_steps;

-- SELECT: admin sees all in org; member sees only own
CREATE POLICY "schedule_steps_select_admin" ON schedule_steps
  FOR SELECT TO authenticated
  USING (
    org_id = auth_org_id()
    AND auth_org_role() = 'admin'
  );

CREATE POLICY "schedule_steps_select_member" ON schedule_steps
  FOR SELECT TO authenticated
  USING (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  );

-- INSERT: any authenticated user inserts steps owned by themselves
CREATE POLICY "schedule_steps_insert_org" ON schedule_steps
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  );

-- UPDATE: admin updates any in org; member updates only own
CREATE POLICY "schedule_steps_update_admin" ON schedule_steps
  FOR UPDATE TO authenticated
  USING (
    org_id = auth_org_id()
    AND auth_org_role() = 'admin'
  )
  WITH CHECK (
    org_id = auth_org_id()
    AND auth_org_role() = 'admin'
  );

CREATE POLICY "schedule_steps_update_member" ON schedule_steps
  FOR UPDATE TO authenticated
  USING (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  )
  WITH CHECK (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  );

-- DELETE: admin deletes any in org; member deletes only own
CREATE POLICY "schedule_steps_delete_admin" ON schedule_steps
  FOR DELETE TO authenticated
  USING (
    org_id = auth_org_id()
    AND auth_org_role() = 'admin'
  );

CREATE POLICY "schedule_steps_delete_member" ON schedule_steps
  FOR DELETE TO authenticated
  USING (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  );

-- ============================================================================
-- TABLE: schedule_client_exclusions
-- Drop old org-scoped policies and replace with owner-scoped policies
-- ============================================================================

DROP POLICY IF EXISTS "schedule_client_exclusions_select_org" ON schedule_client_exclusions;
DROP POLICY IF EXISTS "schedule_client_exclusions_insert_org" ON schedule_client_exclusions;
DROP POLICY IF EXISTS "schedule_client_exclusions_update_org" ON schedule_client_exclusions;
DROP POLICY IF EXISTS "schedule_client_exclusions_delete_org" ON schedule_client_exclusions;

-- SELECT: admin sees all in org; member sees only own
CREATE POLICY "schedule_client_exclusions_select_admin" ON schedule_client_exclusions
  FOR SELECT TO authenticated
  USING (
    org_id = auth_org_id()
    AND auth_org_role() = 'admin'
  );

CREATE POLICY "schedule_client_exclusions_select_member" ON schedule_client_exclusions
  FOR SELECT TO authenticated
  USING (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  );

-- INSERT: any authenticated user inserts exclusions owned by themselves
CREATE POLICY "schedule_client_exclusions_insert_org" ON schedule_client_exclusions
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  );

-- UPDATE: admin updates any in org; member updates only own
CREATE POLICY "schedule_client_exclusions_update_admin" ON schedule_client_exclusions
  FOR UPDATE TO authenticated
  USING (
    org_id = auth_org_id()
    AND auth_org_role() = 'admin'
  )
  WITH CHECK (
    org_id = auth_org_id()
    AND auth_org_role() = 'admin'
  );

CREATE POLICY "schedule_client_exclusions_update_member" ON schedule_client_exclusions
  FOR UPDATE TO authenticated
  USING (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  )
  WITH CHECK (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  );

-- DELETE: admin deletes any in org; member deletes only own
CREATE POLICY "schedule_client_exclusions_delete_admin" ON schedule_client_exclusions
  FOR DELETE TO authenticated
  USING (
    org_id = auth_org_id()
    AND auth_org_role() = 'admin'
  );

CREATE POLICY "schedule_client_exclusions_delete_member" ON schedule_client_exclusions
  FOR DELETE TO authenticated
  USING (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  );

-- ============================================================================
-- TABLE: app_settings
-- Drop old org-scoped policies and recreate with same org-scoping.
-- NOTE: app_settings stays org-scoped (NOT owner-scoped). The user_id filtering
-- is done in application code. This is because:
--   - Org-level defaults (user_id IS NULL) must be readable by all users in org
--   - User-specific rows must be readable by the owning user AND admins
--   - The fallback pattern (read user row, then org default) requires seeing both
-- ============================================================================

DROP POLICY IF EXISTS "app_settings_select_org" ON app_settings;
DROP POLICY IF EXISTS "app_settings_insert_org" ON app_settings;
DROP POLICY IF EXISTS "app_settings_update_org" ON app_settings;
DROP POLICY IF EXISTS "app_settings_delete_org" ON app_settings;

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

-- ============================================================================
-- VALIDATION: Verify new policies exist and old ones are gone
-- ============================================================================

DO $$
DECLARE
  missing_policies text[] := ARRAY[]::text[];
  pol text;
  pol_count integer;

  -- Required policies on resource tables (owner-scoped)
  resource_tables text[] := ARRAY[
    'email_templates',
    'schedules',
    'schedule_steps',
    'schedule_client_exclusions'
  ];

  -- Old org-scoped policy suffixes that should be gone from resource tables
  obsolete_suffixes text[] := ARRAY[
    '_select_org',
    '_update_org',
    '_delete_org'
  ];

  -- New policy suffixes that must exist on resource tables
  required_suffixes text[] := ARRAY[
    '_select_admin',
    '_select_member',
    '_insert_org',
    '_update_admin',
    '_update_member',
    '_delete_admin',
    '_delete_member'
  ];

  tbl text;
  suffix text;
  full_name text;
BEGIN
  -- Check required owner-scoped policies exist on all four resource tables
  FOREACH tbl IN ARRAY resource_tables
  LOOP
    FOREACH suffix IN ARRAY required_suffixes
    LOOP
      full_name := tbl || suffix;
      SELECT COUNT(*) INTO pol_count
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
        AND policyname = full_name;

      IF pol_count = 0 THEN
        missing_policies := array_append(missing_policies, full_name);
      END IF;
    END LOOP;
  END LOOP;

  IF array_length(missing_policies, 1) > 0 THEN
    RAISE EXCEPTION 'VALIDATION FAILED: Missing policies: %', array_to_string(missing_policies, ', ');
  END IF;

  -- Check old org-scoped SELECT/UPDATE/DELETE policies are gone from resource tables
  FOREACH tbl IN ARRAY resource_tables
  LOOP
    FOREACH suffix IN ARRAY obsolete_suffixes
    LOOP
      full_name := tbl || suffix;
      SELECT COUNT(*) INTO pol_count
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
        AND policyname = full_name;

      IF pol_count > 0 THEN
        RAISE EXCEPTION 'VALIDATION FAILED: Obsolete policy still exists: %', full_name;
      END IF;
    END LOOP;
  END LOOP;

  -- Check app_settings org-scoped policies exist (unchanged)
  FOREACH pol IN ARRAY ARRAY[
    'app_settings_select_org',
    'app_settings_insert_org',
    'app_settings_update_org',
    'app_settings_delete_org'
  ]
  LOOP
    SELECT COUNT(*) INTO pol_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'app_settings'
      AND policyname = pol;

    IF pol_count = 0 THEN
      RAISE EXCEPTION 'VALIDATION FAILED: Missing app_settings policy: %', pol;
    END IF;
  END LOOP;

  RAISE NOTICE 'VALIDATION PASSED: Resource tables RLS policies correctly rewritten with owner_id scoping';
END $$;
