/**
 * Tests for plan limit and usage functions (AUDIT-020)
 *
 * Covers:
 *   - checkClientLimit  — allowed/denied based on current count vs limit
 *   - getOrgBillingInfo — returns plan tier, client count, and limit
 *   - getUsageStats     — returns count, limit, and usage percentage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { checkClientLimit, getOrgBillingInfo, getUsageStats } from './usage-limits';
import { createClient } from '@/lib/supabase/server';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a mock Supabase client that supports two sequential from() calls:
 *   1. organisations — returns org data (plan tier + limit)
 *   2. clients       — returns a count
 */
function makeClientMock(opts: {
  orgData?: object | null;
  orgError?: object | null;
  clientCount?: number | null;
  countError?: object | null;
}) {
  let callIndex = 0;

  const fromImpl = vi.fn().mockImplementation((table: string) => {
    if (table === 'organisations') {
      // First call: return org data
      const single = vi.fn().mockResolvedValue({
        data: opts.orgData ?? null,
        error: opts.orgError ?? null,
      });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    }

    if (table === 'clients') {
      // Second call: return count
      const eq = vi.fn().mockResolvedValue({
        count: opts.clientCount ?? null,
        error: opts.countError ?? null,
      });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return { from: fromImpl };
}

// ── checkClientLimit ──────────────────────────────────────────────────────────

describe('checkClientLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows addition when client count is well under the limit', async () => {
    const supabase = makeClientMock({
      orgData: { client_count_limit: 40 },
      clientCount: 10,
    });
    (createClient as any).mockResolvedValue(supabase);

    const result = await checkClientLimit('org-abc');

    expect(result.allowed).toBe(true);
    expect(result.currentCount).toBe(10);
    expect(result.limit).toBe(40);
    expect(result.message).toBeUndefined();
  });

  it('denies addition when client count equals the limit (boundary)', async () => {
    const supabase = makeClientMock({
      orgData: { client_count_limit: 40 },
      clientCount: 40,
    });
    (createClient as any).mockResolvedValue(supabase);

    const result = await checkClientLimit('org-abc');

    expect(result.allowed).toBe(false);
    expect(result.currentCount).toBe(40);
    expect(result.limit).toBe(40);
    expect(result.message).toContain('40');
  });

  it('denies addition when client count exceeds the limit', async () => {
    const supabase = makeClientMock({
      orgData: { client_count_limit: 40 },
      clientCount: 45,
    });
    (createClient as any).mockResolvedValue(supabase);

    const result = await checkClientLimit('org-abc');

    expect(result.allowed).toBe(false);
  });

  it('allows addition for enterprise org with null (unlimited) limit', async () => {
    const supabase = makeClientMock({
      orgData: { client_count_limit: null },
    });
    (createClient as any).mockResolvedValue(supabase);

    const result = await checkClientLimit('org-enterprise');

    expect(result.allowed).toBe(true);
    expect(result.limit).toBeNull();
  });

  it('returns allowed: false with message when org lookup fails', async () => {
    const supabase = makeClientMock({
      orgData: null,
      orgError: { message: 'not found' },
    });
    (createClient as any).mockResolvedValue(supabase);

    const result = await checkClientLimit('org-missing');

    expect(result.allowed).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it('returns allowed: false with message when client count query fails', async () => {
    const supabase = makeClientMock({
      orgData: { client_count_limit: 40 },
      clientCount: null,
      countError: { message: 'query failed' },
    });
    (createClient as any).mockResolvedValue(supabase);

    const result = await checkClientLimit('org-abc');

    expect(result.allowed).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it('treats null count as zero (allows if limit > 0)', async () => {
    const supabase = makeClientMock({
      orgData: { client_count_limit: 10 },
      clientCount: null, // no rows → count is null
    });
    (createClient as any).mockResolvedValue(supabase);

    const result = await checkClientLimit('org-empty');

    expect(result.allowed).toBe(true);
    expect(result.currentCount).toBe(0);
  });

  it('correctly enforces the free plan limit of 10', async () => {
    const supabase = makeClientMock({
      orgData: { client_count_limit: 10 },
      clientCount: 10, // exactly at limit
    });
    (createClient as any).mockResolvedValue(supabase);

    const result = await checkClientLimit('org-free');

    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(10);
  });
});

// ── getOrgBillingInfo ─────────────────────────────────────────────────────────

describe('getOrgBillingInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeBillingMock(opts: {
    orgData?: { plan_tier: string; client_count_limit: number | null } | null;
    clientCount?: number | null;
  }) {
    const fromImpl = vi.fn().mockImplementation((table: string) => {
      if (table === 'organisations') {
        const single = vi.fn().mockResolvedValue({ data: opts.orgData ?? null });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      if (table === 'clients') {
        const eq = vi.fn().mockResolvedValue({ count: opts.clientCount ?? 0 });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
    });
    return { from: fromImpl };
  }

  it('returns plan tier, client count, and limit', async () => {
    const supabase = makeBillingMock({
      orgData: { plan_tier: 'solo', client_count_limit: 40 },
      clientCount: 15,
    });
    (createClient as any).mockResolvedValue(supabase);

    const result = await getOrgBillingInfo('org-abc');

    expect(result).not.toBeNull();
    expect(result!.planTier).toBe('solo');
    expect(result!.clientCount).toBe(15);
    expect(result!.clientLimit).toBe(40);
  });

  it('returns null when org is not found', async () => {
    const supabase = makeBillingMock({ orgData: null });
    (createClient as any).mockResolvedValue(supabase);

    const result = await getOrgBillingInfo('org-missing');

    expect(result).toBeNull();
  });

  it('returns clientLimit as null for enterprise (unlimited) plan', async () => {
    const supabase = makeBillingMock({
      orgData: { plan_tier: 'enterprise', client_count_limit: null },
      clientCount: 500,
    });
    (createClient as any).mockResolvedValue(supabase);

    const result = await getOrgBillingInfo('org-enterprise');

    expect(result!.planTier).toBe('enterprise');
    expect(result!.clientLimit).toBeNull();
  });

  it('treats null count as 0', async () => {
    const supabase = makeBillingMock({
      orgData: { plan_tier: 'free', client_count_limit: 10 },
      clientCount: null,
    });
    (createClient as any).mockResolvedValue(supabase);

    const result = await getOrgBillingInfo('org-new');

    expect(result!.clientCount).toBe(0);
  });
});

// ── getUsageStats ─────────────────────────────────────────────────────────────

describe('getUsageStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeStatsMock(opts: {
    orgData?: { client_count_limit: number | null } | null;
    clientCount?: number | null;
  }) {
    const fromImpl = vi.fn().mockImplementation((table: string) => {
      if (table === 'organisations') {
        const single = vi.fn().mockResolvedValue({ data: opts.orgData ?? null });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      if (table === 'clients') {
        const eq = vi.fn().mockResolvedValue({ count: opts.clientCount ?? 0 });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
    });
    return { from: fromImpl };
  }

  it('returns correct usage percentage when under limit', async () => {
    const supabase = makeStatsMock({
      orgData: { client_count_limit: 40 },
      clientCount: 10,
    });
    (createClient as any).mockResolvedValue(supabase);

    const stats = await getUsageStats('org-abc');

    expect(stats.clientCount).toBe(10);
    expect(stats.clientLimit).toBe(40);
    expect(stats.clientUsagePercent).toBe(25); // 10/40 = 25%
  });

  it('returns 100% when exactly at limit', async () => {
    const supabase = makeStatsMock({
      orgData: { client_count_limit: 80 },
      clientCount: 80,
    });
    (createClient as any).mockResolvedValue(supabase);

    const stats = await getUsageStats('org-full');

    expect(stats.clientUsagePercent).toBe(100);
  });

  it('returns clientUsagePercent as null for unlimited plan', async () => {
    const supabase = makeStatsMock({
      orgData: { client_count_limit: null },
      clientCount: 300,
    });
    (createClient as any).mockResolvedValue(supabase);

    const stats = await getUsageStats('org-enterprise');

    expect(stats.clientUsagePercent).toBeNull();
    expect(stats.clientLimit).toBeNull();
  });

  it('returns clientUsagePercent as null when org has no limit set', async () => {
    const supabase = makeStatsMock({ orgData: null });
    (createClient as any).mockResolvedValue(supabase);

    const stats = await getUsageStats('org-ghost');

    expect(stats.clientUsagePercent).toBeNull();
  });

  it('rounds usage percentage to nearest integer', async () => {
    const supabase = makeStatsMock({
      orgData: { client_count_limit: 3 },
      clientCount: 1, // 1/3 = 33.33...%
    });
    (createClient as any).mockResolvedValue(supabase);

    const stats = await getUsageStats('org-abc');

    expect(stats.clientUsagePercent).toBe(33);
  });
});
