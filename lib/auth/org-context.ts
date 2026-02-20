import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Get the current user's org_id.
 *
 * Resolution order:
 * 1. JWT session claims (app_metadata.org_id) — fast path when hook is active
 * 2. Direct user_organisations lookup via admin client — fallback for stale
 *    sessions issued before the Custom Access Token Hook was enabled
 *
 * @throws Error if not authenticated or user has no org assignment
 */
export async function getOrgId(): Promise<string> {
  const supabase = await createClient();
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    throw new Error('Not authenticated');
  }

  // Fast path: JWT hook has injected org_id
  const orgId = session.user.app_metadata?.org_id;
  if (orgId) {
    return orgId;
  }

  // Fallback: query user_organisations directly (bypasses RLS via admin client)
  const admin = createAdminClient();
  const { data: userOrg } = await admin
    .from('user_organisations')
    .select('org_id')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (!userOrg?.org_id) {
    throw new Error('No org_id in user session — user may not be assigned to an organisation');
  }

  return userOrg.org_id;
}

/**
 * Get both org_id and org_role from the current user's session.
 *
 * Same resolution order as getOrgId() with role fallback to 'member'.
 *
 * @throws Error if not authenticated or user has no org assignment
 */
export async function getOrgContext(): Promise<{ orgId: string; orgRole: string }> {
  const supabase = await createClient();
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    throw new Error('Not authenticated');
  }

  // Fast path: JWT hook claims
  const orgId = session.user.app_metadata?.org_id;
  const orgRole = session.user.app_metadata?.org_role;
  if (orgId) {
    return { orgId, orgRole: orgRole || 'member' };
  }

  // Fallback: direct lookup
  const admin = createAdminClient();
  const { data: userOrg } = await admin
    .from('user_organisations')
    .select('org_id, role')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (!userOrg?.org_id) {
    throw new Error('No org_id in user session');
  }

  return { orgId: userOrg.org_id, orgRole: userOrg.role || 'member' };
}
