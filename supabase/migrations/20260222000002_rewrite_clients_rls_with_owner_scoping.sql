-- Downtime risk: NONE — safe for zero-downtime deployment
-- Quick Task 5: Accountant-Scoped Client Isolation
-- Migration 2/2: Rewrite clients RLS policies with owner_id scoping
--
-- Replaces the four org-scoped clients policies (from 20260219000005) with
-- role-aware policies that enforce:
--   - Members see only clients where owner_id = auth.uid()
--   - Admins see all clients in the org (org_id scoping only)
--
-- This migration also creates the auth_org_role() helper function (similar to
-- the existing auth_org_id() helper) to extract org_role from JWT claims.
--
-- IMPORTANT: Service role policy for cron/webhooks is left unchanged.

-- ============================================================================
-- HELPER FUNCTION: auth_org_role()
-- Extracts org_role from JWT app_metadata claims.
-- Defaults to 'member' if the claim is missing (safe default — restricts access).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auth_org_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'org_role',
    'member'
  );
$$;

GRANT EXECUTE ON FUNCTION public.auth_org_role TO authenticated;

-- ============================================================================
-- DROP OLD ORG-SCOPED CLIENTS POLICIES
-- (created by 20260219000005_rewrite_rls_policies.sql)
-- ============================================================================

DROP POLICY IF EXISTS "clients_select_org" ON clients;
DROP POLICY IF EXISTS "clients_insert_org" ON clients;
DROP POLICY IF EXISTS "clients_update_org" ON clients;
DROP POLICY IF EXISTS "clients_delete_org" ON clients;

-- ============================================================================
-- SELECT policies
--
-- Two permissive policies — PostgreSQL OR's them together:
--   - Admins see all clients in their org
--   - Members see only clients they own
-- ============================================================================

CREATE POLICY "clients_select_admin" ON clients
  FOR SELECT TO authenticated
  USING (
    org_id = auth_org_id()
    AND auth_org_role() = 'admin'
  );

CREATE POLICY "clients_select_member" ON clients
  FOR SELECT TO authenticated
  USING (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  );

-- ============================================================================
-- INSERT policy
--
-- Both admins and members insert clients owned by themselves.
-- Admins can reassign clients later via the reassignClients server action
-- (which uses the service_role client to bypass RLS).
-- ============================================================================

CREATE POLICY "clients_insert_org" ON clients
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  );

-- ============================================================================
-- UPDATE policies
--
-- Two permissive policies — PostgreSQL OR's them together:
--   - Admins can update any client in their org
--   - Members can only update clients they own
-- ============================================================================

CREATE POLICY "clients_update_admin" ON clients
  FOR UPDATE TO authenticated
  USING (
    org_id = auth_org_id()
    AND auth_org_role() = 'admin'
  )
  WITH CHECK (
    org_id = auth_org_id()
    AND auth_org_role() = 'admin'
  );

CREATE POLICY "clients_update_member" ON clients
  FOR UPDATE TO authenticated
  USING (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  )
  WITH CHECK (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  );

-- ============================================================================
-- DELETE policies
--
-- Two permissive policies — PostgreSQL OR's them together:
--   - Admins can delete any client in their org
--   - Members can only delete clients they own
-- ============================================================================

CREATE POLICY "clients_delete_admin" ON clients
  FOR DELETE TO authenticated
  USING (
    org_id = auth_org_id()
    AND auth_org_role() = 'admin'
  );

CREATE POLICY "clients_delete_member" ON clients
  FOR DELETE TO authenticated
  USING (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  );

-- ============================================================================
-- VALIDATION: Verify new policies exist and old ones are gone
-- ============================================================================

DO $$
DECLARE
  missing_policies text[] := ARRAY[]::text[];
  obsolete_policies text[] := ARRAY[
    'clients_select_org',
    'clients_update_org',
    'clients_delete_org'
  ];
  required_policies text[] := ARRAY[
    'clients_select_admin',
    'clients_select_member',
    'clients_insert_org',
    'clients_update_admin',
    'clients_update_member',
    'clients_delete_admin',
    'clients_delete_member'
  ];
  pol text;
  pol_count integer;
BEGIN
  -- Check required policies exist
  FOREACH pol IN ARRAY required_policies
  LOOP
    SELECT COUNT(*) INTO pol_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clients'
      AND policyname = pol;

    IF pol_count = 0 THEN
      missing_policies := array_append(missing_policies, pol);
    END IF;
  END LOOP;

  IF array_length(missing_policies, 1) > 0 THEN
    RAISE EXCEPTION 'VALIDATION FAILED: Missing policies on clients: %', array_to_string(missing_policies, ', ');
  END IF;

  -- Check obsolete policies are gone
  FOREACH pol IN ARRAY obsolete_policies
  LOOP
    SELECT COUNT(*) INTO pol_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clients'
      AND policyname = pol;

    IF pol_count > 0 THEN
      RAISE EXCEPTION 'VALIDATION FAILED: Obsolete policy still exists on clients: %', pol;
    END IF;
  END LOOP;

  RAISE NOTICE 'VALIDATION PASSED: clients RLS policies correctly rewritten with owner_id scoping';
END $$;
