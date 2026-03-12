import { SupabaseClient } from '@supabase/supabase-js';

export interface OnboardingProgress {
  hasClient: boolean;
  hasEmailTemplate: boolean;
  hasEmailSent: boolean;
  hasPortalLink: boolean;
  dismissed: boolean;
}

/**
 * Check onboarding milestone completion by querying existing tables.
 * No event listeners needed — all derived from current state.
 */
export async function getOnboardingProgress(
  supabase: SupabaseClient
): Promise<OnboardingProgress> {
  const [clientRes, templateRes, emailRes, portalRes, dismissedRes] =
    await Promise.all([
      // 1. Has at least one active client
      supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('active', true)
        .limit(1),

      // 2. Has at least one custom email template
      supabase
        .from('email_templates')
        .select('id', { count: 'exact', head: true })
        .eq('is_custom', true)
        .limit(1),

      // 3. Has sent at least one email
      supabase
        .from('email_log')
        .select('id', { count: 'exact', head: true })
        .not('sent_at', 'is', null)
        .limit(1),

      // 4. Has created at least one portal link
      supabase
        .from('upload_portal_tokens')
        .select('id', { count: 'exact', head: true })
        .limit(1),

      // Check if dismissed
      supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'onboarding_complete')
        .is('user_id', null)
        .maybeSingle(),
    ]);

  return {
    hasClient: (clientRes.count ?? 0) > 0,
    hasEmailTemplate: (templateRes.count ?? 0) > 0,
    hasEmailSent: (emailRes.count ?? 0) > 0,
    hasPortalLink: (portalRes.count ?? 0) > 0,
    dismissed: dismissedRes.data?.value === 'true',
  };
}
