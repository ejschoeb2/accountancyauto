import { createClient } from '@/lib/supabase/server';

/**
 * Get the current user's org_id from JWT claims (app_metadata).
 *
 * Used by server actions that need to explicitly pass org_id:
 * - INSERT operations (RLS WITH CHECK validates but doesn't auto-set)
 * - app_settings queries (unique constraint is now (org_id, key))
 * - Upserts that target the (org_id, key) conflict
 *
 * @throws Error if not authenticated or no org_id in claims
 */
export async function getOrgId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Not authenticated');
  }

  const orgId = user.app_metadata?.org_id;
  if (!orgId) {
    throw new Error('No org_id in user session — user may not be assigned to an organisation');
  }

  return orgId;
}

/**
 * Get both org_id and org_role from the current user's JWT claims.
 *
 * org_role defaults to 'member' if not set in app_metadata.
 *
 * @throws Error if not authenticated or no org_id in claims
 */
export async function getOrgContext(): Promise<{ orgId: string; orgRole: string }> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Not authenticated');
  }

  const orgId = user.app_metadata?.org_id;
  const orgRole = user.app_metadata?.org_role;

  if (!orgId) {
    throw new Error('No org_id in user session');
  }

  return { orgId, orgRole: orgRole || 'member' };
}
