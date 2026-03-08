import { NextResponse, type NextRequest } from 'next/server';
import { type OrgInfo } from './subdomain';

/**
 * Enforce subscription status for org access.
 *
 * Allows through:
 * - /auth, /login, /api routes (always accessible)
 * - Active subscriptions
 * - Valid trials (trial_ends_at in future)
 * - Inactive subscriptions: /dashboard and /settings only
 *
 * Redirects to /settings?tab=billing for:
 * - Cancelled, past_due, unpaid subscriptions
 * - Expired trials
 *
 * Returns null to allow through, or redirect Response to /settings?tab=billing.
 */
export function enforceSubscription(
  request: NextRequest,
  org: OrgInfo
): NextResponse | null {
  const { pathname } = request.nextUrl;

  // Always allow through: auth, login, API routes, setup wizard
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/setup')
  ) {
    return null;
  }

  // Active subscription: allow through
  if (org.subscription_status === 'active') {
    return null;
  }

  // Trialing: check if trial is still valid
  if (org.subscription_status === 'trialing' && org.trial_ends_at) {
    const trialEnd = new Date(org.trial_ends_at);
    const now = new Date();
    if (trialEnd > now) {
      return null; // Trial still active
    }
  }

  // Inactive subscription: allow dashboard and settings through
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/settings')) {
    return null;
  }

  // Everything else: redirect to billing tab in settings
  return NextResponse.redirect(new URL('/settings?tab=billing', request.url), 307);
}
