-- Downtime risk: NONE — safe for zero-downtime deployment
-- Phase 10 Plan 02: JWT Custom Access Token Hook
-- Migration 1/2: Create the hook function + auth_org_id() helper
--
-- This function is called by Supabase Auth every time it issues/refreshes a JWT.
-- It looks up the user's org membership from user_organisations and injects
-- org_id and org_role into app_metadata claims.
--
-- CRITICAL: Uses app_metadata (NOT user_metadata) because user_metadata is
-- client-writable and would allow users to change their own org_id.
--
-- IMPORTANT: After applying this migration, you must enable the hook in the
-- Supabase Dashboard:
--   1. Go to Authentication > Hooks (under Configuration)
--   2. Enable "Custom Access Token Hook"
--   3. Select schema: public, function: custom_access_token_hook
--   4. Save
-- This step cannot be automated via SQL — it requires dashboard configuration.

-- ============================================================================
-- FUNCTION: custom_access_token_hook
-- Called by Supabase Auth (as supabase_auth_admin role) on every token issue
-- ============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_org record;
BEGIN
  -- Extract the claims from the event
  claims := event->'claims';

  -- Look up the user's org membership
  -- If user belongs to multiple orgs, pick the first one (oldest by created_at).
  -- Phase 13 will add org switching for multi-org users.
  SELECT uo.org_id, uo.role
  INTO user_org
  FROM public.user_organisations uo
  WHERE uo.user_id = (event->>'user_id')::uuid
  ORDER BY uo.created_at ASC
  LIMIT 1;

  -- If user has an org membership, inject into app_metadata
  IF user_org IS NOT NULL THEN
    claims := jsonb_set(
      claims,
      '{app_metadata}',
      COALESCE(claims->'app_metadata', '{}'::jsonb) ||
      jsonb_build_object(
        'org_id', user_org.org_id::text,
        'org_role', user_org.role::text
      )
    );
  END IF;

  -- Return the modified event with updated claims
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- ============================================================================
-- PERMISSIONS: Hook is called by supabase_auth_admin
-- ============================================================================

-- Supabase Auth calls hooks as the supabase_auth_admin role
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- The hook needs to read user_organisations to look up org membership
GRANT SELECT ON TABLE public.user_organisations TO supabase_auth_admin;

-- Revoke execute from other roles (security hardening)
-- Only supabase_auth_admin should call this function
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- ============================================================================
-- FUNCTION: auth_org_id() — Helper for RLS policies
-- Extracts org_id from JWT app_metadata claims.
-- Used in RLS policies to avoid repeating the JSONPath expression.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auth_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'org_id')::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$;

-- COALESCE to zero UUID ensures that if the claim is missing, the function
-- returns a UUID that matches nothing (rather than NULL, which would cause
-- unexpected behavior in equality checks — NULL = anything is NULL, not false).

-- Grant execute to authenticated role (used in RLS policies)
GRANT EXECUTE ON FUNCTION public.auth_org_id TO authenticated;
