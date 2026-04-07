/**
 * Tests for Stripe webhook handler functions (AUDIT-014)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock the Stripe client so subscriptions.retrieve is controllable
vi.mock('@/lib/stripe/client', () => ({
  stripe: {
    subscriptions: {
      retrieve: vi.fn(),
    },
  },
}));

// Mock the payment-failed notification so we don't hit Postmark
vi.mock('@/lib/billing/notifications', () => ({
  sendPaymentFailedEmail: vi.fn(),
}));

// Mock logger to suppress output during tests
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Imports (after mocks are registered) ─────────────────────────────────────

import {
  handleCheckoutSessionCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentFailed,
} from './webhook-handlers';
import { stripe } from '@/lib/stripe/client';
import { sendPaymentFailedEmail } from '@/lib/billing/notifications';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a minimal mock SupabaseClient whose method chains can be overridden
 * per-test via the returned `mocks` object.
 */
function makeSupabaseMock(overrides: {
  updateError?: object | null;
  selectData?: object | null;
  selectError?: object | null;
} = {}) {
  const updateEq = vi.fn().mockResolvedValue({ error: overrides.updateError ?? null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });

  const maybeSingle = vi.fn().mockResolvedValue({
    data: overrides.selectData ?? null,
    error: overrides.selectError ?? null,
  });
  const single = vi.fn().mockResolvedValue({
    data: overrides.selectData ?? null,
    error: overrides.selectError ?? null,
  });
  const selectEq = vi.fn().mockReturnValue({ maybeSingle, single });
  const select = vi.fn().mockReturnValue({ eq: selectEq });

  const from = vi.fn().mockReturnValue({ update, select });

  const supabase = { from } as unknown as SupabaseClient;
  return { supabase, from, update, updateEq, select, selectEq, maybeSingle, single };
}

/** Build a minimal Stripe Checkout Session object */
function makeSession(overrides: Partial<{
  orgId: string;
  planTier: string;
  customer: string;
  subscription: string;
}> = {}) {
  return {
    id: 'cs_test_123',
    metadata: {
      org_id: overrides.orgId ?? 'org-abc',
      plan_tier: overrides.planTier ?? 'solo',
    },
    customer: overrides.customer ?? 'cus_test_456',
    subscription: overrides.subscription ?? 'sub_test_789',
  } as any;
}

/** Build a minimal Stripe Subscription object */
function makeSubscription(overrides: Partial<{
  id: string;
  status: string;
  priceId: string;
  trialEnd: number | null;
}> = {}) {
  return {
    id: overrides.id ?? 'sub_test_789',
    status: overrides.status ?? 'active',
    trial_end: overrides.trialEnd ?? null,
    items: {
      data: [{ price: { id: overrides.priceId ?? 'price_solo_test' } }],
    },
  } as any;
}

// ── handleCheckoutSessionCompleted ────────────────────────────────────────────

describe('handleCheckoutSessionCompleted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates the org with correct limits for solo plan', async () => {
    const { supabase, update, updateEq } = makeSupabaseMock();
    (stripe.subscriptions.retrieve as any).mockResolvedValue(
      makeSubscription({ status: 'active' })
    );

    await handleCheckoutSessionCompleted(makeSession({ planTier: 'solo' }), supabase);

    expect(update).toHaveBeenCalledOnce();
    const payload = update.mock.calls[0][0];
    expect(payload.plan_tier).toBe('solo');
    expect(payload.client_count_limit).toBe(40);
    expect(payload.subscription_status).toBe('active');
    expect(updateEq).toHaveBeenCalledWith('id', 'org-abc');
  });

  it('updates the org with correct limits for practice plan', async () => {
    const { supabase, update } = makeSupabaseMock();
    (stripe.subscriptions.retrieve as any).mockResolvedValue(
      makeSubscription({ status: 'active' })
    );

    await handleCheckoutSessionCompleted(makeSession({ planTier: 'practice' }), supabase);

    const payload = update.mock.calls[0][0];
    expect(payload.plan_tier).toBe('practice');
    expect(payload.client_count_limit).toBe(200);
  });

  it('sets trial_ends_at when subscription has a trial_end', async () => {
    const { supabase, update } = makeSupabaseMock();
    const trialEndTimestamp = 1800000000; // unix seconds
    (stripe.subscriptions.retrieve as any).mockResolvedValue(
      makeSubscription({ trialEnd: trialEndTimestamp })
    );

    await handleCheckoutSessionCompleted(makeSession(), supabase);

    const payload = update.mock.calls[0][0];
    expect(payload.trial_ends_at).toBe(new Date(trialEndTimestamp * 1000).toISOString());
  });

  it('sets trial_ends_at to null when there is no trial', async () => {
    const { supabase, update } = makeSupabaseMock();
    (stripe.subscriptions.retrieve as any).mockResolvedValue(
      makeSubscription({ trialEnd: null })
    );

    await handleCheckoutSessionCompleted(makeSession(), supabase);

    const payload = update.mock.calls[0][0];
    expect(payload.trial_ends_at).toBeNull();
  });

  it('returns early when org_id is missing from metadata', async () => {
    const { supabase, from } = makeSupabaseMock();
    const session = { id: 'cs_test', metadata: {}, customer: 'cus_x', subscription: 'sub_x' } as any;

    await handleCheckoutSessionCompleted(session, supabase);

    expect(from).not.toHaveBeenCalled();
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it('returns early when subscription ID is missing', async () => {
    const { supabase, from } = makeSupabaseMock();
    const session = makeSession({ subscription: '' as any });
    (session as any).subscription = null;

    await handleCheckoutSessionCompleted(session, supabase);

    expect(from).not.toHaveBeenCalled();
  });

  it('returns early when Stripe subscription retrieve fails', async () => {
    const { supabase, update } = makeSupabaseMock();
    (stripe.subscriptions.retrieve as any).mockRejectedValue(new Error('Network error'));

    await handleCheckoutSessionCompleted(makeSession(), supabase);

    expect(update).not.toHaveBeenCalled();
  });

  it('does not throw when Supabase update returns an error', async () => {
    const { supabase } = makeSupabaseMock({ updateError: { message: 'DB error' } });
    (stripe.subscriptions.retrieve as any).mockResolvedValue(makeSubscription());

    // Should not throw — the handler logs and returns
    await expect(handleCheckoutSessionCompleted(makeSession(), supabase)).resolves.toBeUndefined();
  });
});

// ── handleSubscriptionUpdated ─────────────────────────────────────────────────

describe('handleSubscriptionUpdated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates subscription status when plan has not changed', async () => {
    const mockOrg = { id: 'org-abc', stripe_price_id: 'price_solo_test' };
    const { supabase, update } = makeSupabaseMock({ selectData: mockOrg });

    const subscription = makeSubscription({
      id: 'sub_test_789',
      status: 'past_due',
      priceId: 'price_solo_test', // same price — no plan change
    });

    await handleSubscriptionUpdated(subscription, supabase);

    expect(update).toHaveBeenCalledOnce();
    const payload = update.mock.calls[0][0];
    expect(payload.subscription_status).toBe('past_due');
    // No plan_tier change
    expect(payload.plan_tier).toBeUndefined();
  });

  it('updates plan_tier and client_count_limit when price matches a known plan', async () => {
    // Mock getPlanByPriceId so this test works regardless of env var configuration.
    // We import plans inline and spy so the handler picks up the mock.
    const plans = await import('@/lib/stripe/plans');
    const getPlanSpy = vi.spyOn(plans, 'getPlanByPriceId').mockReturnValue({
      tier: 'starter',
      name: 'Starter',
      priceId: 'price_starter_test',
      monthlyPrice: 3900,
      clientLimit: 80,
      features: [],
    });

    const mockOrg = { id: 'org-abc', stripe_price_id: 'price_solo_test' };
    const { supabase, update } = makeSupabaseMock({ selectData: mockOrg });

    const subscription = makeSubscription({
      status: 'active',
      priceId: 'price_starter_test',
    });

    await handleSubscriptionUpdated(subscription, supabase);

    const payload = update.mock.calls[0][0];
    expect(payload.plan_tier).toBe('starter');
    expect(payload.client_count_limit).toBe(80);
    expect(payload.stripe_price_id).toBe('price_starter_test');

    getPlanSpy.mockRestore();
  });

  it('updates stripe_price_id only when new price is unknown', async () => {
    const mockOrg = { id: 'org-abc', stripe_price_id: 'price_old' };
    const { supabase, update } = makeSupabaseMock({ selectData: mockOrg });

    const subscription = makeSubscription({ status: 'active', priceId: 'price_unknown_xyz' });

    await handleSubscriptionUpdated(subscription, supabase);

    const payload = update.mock.calls[0][0];
    expect(payload.stripe_price_id).toBe('price_unknown_xyz');
    expect(payload.plan_tier).toBeUndefined();
  });

  it('returns early when no org is found for the subscription', async () => {
    const { supabase, update } = makeSupabaseMock({ selectData: null });

    await handleSubscriptionUpdated(makeSubscription(), supabase);

    expect(update).not.toHaveBeenCalled();
  });

  it('returns early when the org lookup returns an error', async () => {
    const { supabase, update } = makeSupabaseMock({ selectError: { message: 'DB error' } });

    await handleSubscriptionUpdated(makeSubscription(), supabase);

    expect(update).not.toHaveBeenCalled();
  });
});

// ── handleSubscriptionDeleted ─────────────────────────────────────────────────

describe('handleSubscriptionDeleted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks the org subscription_status as cancelled', async () => {
    const mockOrg = { id: 'org-abc', plan_tier: 'solo' };
    const { supabase, update, updateEq } = makeSupabaseMock({ selectData: mockOrg });

    await handleSubscriptionDeleted(makeSubscription(), supabase);

    expect(update).toHaveBeenCalledOnce();
    const payload = update.mock.calls[0][0];
    expect(payload.subscription_status).toBe('cancelled');
    expect(updateEq).toHaveBeenCalledWith('id', 'org-abc');
  });

  it('skips update when org is already on free plan', async () => {
    const mockOrg = { id: 'org-abc', plan_tier: 'free' };
    const { supabase, update } = makeSupabaseMock({ selectData: mockOrg });

    await handleSubscriptionDeleted(makeSubscription(), supabase);

    expect(update).not.toHaveBeenCalled();
  });

  it('returns early when no org is found for the subscription', async () => {
    const { supabase, update } = makeSupabaseMock({ selectData: null });

    await handleSubscriptionDeleted(makeSubscription(), supabase);

    expect(update).not.toHaveBeenCalled();
  });

  it('returns early when org lookup returns a DB error', async () => {
    const { supabase, update } = makeSupabaseMock({ selectError: { message: 'DB error' } });

    await handleSubscriptionDeleted(makeSubscription(), supabase);

    expect(update).not.toHaveBeenCalled();
  });
});

// ── handleInvoicePaymentFailed ────────────────────────────────────────────────

describe('handleInvoicePaymentFailed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks the org as past_due and triggers payment-failed email', async () => {
    const mockOrg = { id: 'org-abc' };
    const { supabase, update } = makeSupabaseMock({ selectData: mockOrg });

    const invoice = { id: 'inv_test', customer: 'cus_test_456' } as any;

    await handleInvoicePaymentFailed(invoice, supabase);

    expect(update).toHaveBeenCalledOnce();
    const payload = update.mock.calls[0][0];
    expect(payload.subscription_status).toBe('past_due');
    expect(sendPaymentFailedEmail).toHaveBeenCalledWith('org-abc', supabase);
  });

  it('returns early when customer ID is missing from invoice', async () => {
    const { supabase, from } = makeSupabaseMock();
    const invoice = { id: 'inv_test', customer: null } as any;

    await handleInvoicePaymentFailed(invoice, supabase);

    expect(from).not.toHaveBeenCalled();
    expect(sendPaymentFailedEmail).not.toHaveBeenCalled();
  });

  it('returns early when no org is found for the customer ID', async () => {
    const { supabase, update } = makeSupabaseMock({ selectData: null });
    const invoice = { id: 'inv_test', customer: 'cus_unknown' } as any;

    await handleInvoicePaymentFailed(invoice, supabase);

    expect(update).not.toHaveBeenCalled();
    expect(sendPaymentFailedEmail).not.toHaveBeenCalled();
  });

  it('still sends payment-failed email even if DB update fails', async () => {
    const mockOrg = { id: 'org-abc' };
    const { supabase } = makeSupabaseMock({
      selectData: mockOrg,
      updateError: { message: 'DB write error' },
    });

    const invoice = { id: 'inv_test', customer: 'cus_test_456' } as any;

    await handleInvoicePaymentFailed(invoice, supabase);

    // Email should still fire even though DB update failed
    expect(sendPaymentFailedEmail).toHaveBeenCalledWith('org-abc', supabase);
  });

  it('does not throw when sendPaymentFailedEmail rejects', async () => {
    const mockOrg = { id: 'org-abc' };
    const { supabase } = makeSupabaseMock({ selectData: mockOrg });
    (sendPaymentFailedEmail as any).mockRejectedValue(new Error('Postmark error'));

    const invoice = { id: 'inv_test', customer: 'cus_test_456' } as any;

    await expect(handleInvoicePaymentFailed(invoice, supabase)).resolves.toBeUndefined();
  });
});
