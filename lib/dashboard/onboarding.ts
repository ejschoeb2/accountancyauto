import { SupabaseClient } from '@supabase/supabase-js';

export interface OnboardingProgress {
  hasReviewedProgress: boolean;
  hasCheckedTemplates: boolean;
  hasCheckedQueue: boolean;
  hasEmailSent: boolean;
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
  const [emailRes, dismissedRes, progressReviewedRes, templatesVisitedRes, activityVisitedRes] =
    await Promise.all([
      // Step 4: Has sent at least one email (data-derived)
      supabase
        .from('email_log')
        .select('id', { count: 'exact', head: true })
        .not('sent_at', 'is', null)
        .limit(1),

      // Check if dismissed
      supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'onboarding_complete')
        .is('user_id', null)
        .maybeSingle(),

      // Step 1: Has reviewed client progress (explicit)
      supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'progress_reviewed')
        .is('user_id', null)
        .maybeSingle(),

      // Step 2: Has visited templates page (explicit)
      supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'templates_visited')
        .is('user_id', null)
        .maybeSingle(),

      // Step 3: Has visited activity page (explicit)
      supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'activity_visited')
        .is('user_id', null)
        .maybeSingle(),
    ]);

  return {
    hasReviewedProgress: progressReviewedRes.data?.value === 'true',
    hasCheckedTemplates: templatesVisitedRes.data?.value === 'true',
    hasCheckedQueue: activityVisitedRes.data?.value === 'true',
    hasEmailSent: (emailRes.count ?? 0) > 0,
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
