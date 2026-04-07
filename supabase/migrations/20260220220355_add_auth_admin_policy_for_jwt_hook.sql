-- Downtime risk: NONE — safe for zero-downtime deployment
-- Fix: The JWT Custom Access Token Hook runs as supabase_auth_admin,
-- which has a SELECT grant on user_organisations but no RLS policy.
-- Without this policy, the hook's query silently returns zero rows
-- and org_id/org_role are never injected into the JWT.

CREATE POLICY "Allow auth admin to read user_organisations"
  ON public.user_organisations
  AS PERMISSIVE
  FOR SELECT
  TO supabase_auth_admin
  USING (true);
