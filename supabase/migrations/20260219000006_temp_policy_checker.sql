-- TEMPORARY: Policy inspection function (will be dropped after verification)
CREATE OR REPLACE FUNCTION public._debug_list_policies()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'tbl', tablename,
    'pol', policyname,
    'cmd', cmd,
    'roles', roles::text,
    'qual', qual::text
  ) ORDER BY tablename, policyname), '[]'::jsonb)
  FROM pg_policies
  WHERE schemaname = 'public';
$$;

GRANT EXECUTE ON FUNCTION public._debug_list_policies TO service_role;
