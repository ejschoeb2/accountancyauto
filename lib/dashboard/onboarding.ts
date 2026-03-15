import { SupabaseClient } from '@supabase/supabase-js';

export interface OnboardingProgress {
  hasClient: boolean;
  hasEmailTemplate: boolean;
  hasEmailSent: boolean;
  hasPortalLink: boolean;
  dismissed: boolean;
}

export interface GoFurtherProgress {
  hasPortalEnabled: boolean;
  hasCustomDomain: boolean;
  hasUploadChecks: boolean;
  hasCustomSchedule: boolean;
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

/**
 * Check advanced feature adoption for the "Go further" checklist.
 */
export async function getGoFurtherProgress(
  supabase: SupabaseClient
): Promise<GoFurtherProgress> {
  const [orgRes, customScheduleRes] = await Promise.all([
    // Org-level feature flags (portal, domain, upload checks)
    supabase
      .from('organisations')
      .select('client_portal_enabled, email_domain_verified, upload_check_mode')
      .single(),

    // Has at least one custom schedule
    supabase
      .from('schedules')
      .select('id', { count: 'exact', head: true })
      .eq('schedule_type', 'custom')
      .limit(1),
  ]);

  const org = orgRes.data;

  return {
    hasPortalEnabled: org?.client_portal_enabled === true,
    hasCustomDomain: org?.email_domain_verified === true,
    hasUploadChecks: !!org?.upload_check_mode && org.upload_check_mode !== 'none',
    hasCustomSchedule: (customScheduleRes.count ?? 0) > 0,
  };
}
