import { NextResponse, type NextRequest } from 'next/server';
import { type OrgInfo } from './subdomain';

/**
 * Enforce subscription status for org access.
 *
 * Allows through:
 * - /billing, /auth, /login, /api routes (always accessible)
 * - Active subscriptions
 * - Valid trials (trial_ends_at in future)
 *
 * Redirects to /billing for:
 * - Cancelled, past_due, unpaid subscriptions
 * - Expired trials
 *
 * Returns null to allow through, or redirect Response to /billing.
 */
export function enforceSubscription(
  request: NextRequest,
  org: OrgInfo
): NextResponse | null {
  const { pathname } = request.nextUrl;

  // Always allow through: billing, auth, login, API routes, setup wizard
  if (
    pathname.startsWith('/billing') ||
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

  // Subscription issue: redirect to billing
  return NextResponse.redirect(new URL('/billing', request.url), 307);
}
