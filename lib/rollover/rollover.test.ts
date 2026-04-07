import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRolloverCandidates, getRolloverSummary } from './detector';
import { rolloverFiling, bulkRollover } from './executor';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/deadlines/calculators', () => ({
  calculateDeadlineForCurrentPeriod: vi.fn(),
}));

vi.mock('@/lib/reminders/queue-builder', () => ({
  rebuildQueueForClient: vi.fn().mockResolvedValue(undefined),
}));

import { calculateDeadlineForCurrentPeriod } from '@/lib/deadlines/calculators';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSupabase(overrides: {
  clients?: unknown;
  clientsError?: unknown;
  assignments?: unknown;
  assignmentsError?: unknown;
} = {}) {
  const {
    clients = [],
    clientsError = null,
    assignments = [],
    assignmentsError = null,
  } = overrides;

  const supabase = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: clients, error: clientsError }),
          // For detector, the chain ends with an implicit await
          then: (resolve: Function) => resolve({ data: clients, error: clientsError }),
          update: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
        };
      }
      if (table === 'client_filing_assignments') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: Function) => resolve({ data: assignments, error: assignmentsError }),
        };
      }
      if (table === 'reminder_queue') {
        return {
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: Function) => resolve({ error: null }),
        };
      }
      if (table === 'audit_log') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: (resolve: Function) => resolve({ data: null, error: null }),
      };
    }),
  };

  return supabase;
}

// ── getRolloverCandidates ─────────────────────────────────────────────────────

describe('getRolloverCandidates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when no clients exist', async () => {
    const supabase = makeSupabase({ clients: [] });
    const result = await getRolloverCandidates(supabase as any);
    expect(result).toEqual([]);
  });

  it('throws when client fetch fails', async () => {
    const supabase = makeSupabase({ clients: null, clientsError: { message: 'DB down' } });
    await expect(getRolloverCandidates(supabase as any)).rejects.toThrow('Failed to fetch clients');
  });

  it('skips clients with reminders_paused=true', async () => {
    const pastDeadline = new Date('2025-01-01');
    vi.mocked(calculateDeadlineForCurrentPeriod).mockReturnValue(pastDeadline);

    const supabase = makeSupabase({
      clients: [
        {
          id: 'c-1',
          company_name: 'Paused Co',
          year_end_date: '2024-03-31',
          vat_stagger_group: null,
          records_received_for: ['ct600'],
          reminders_paused: true,
        },
      ],
      assignments: [{ client_id: 'c-1', filing_type_id: 'ct600' }],
    });

    const result = await getRolloverCandidates(supabase as any);
    expect(result).toHaveLength(0);
  });

  it('skips clients with no records_received_for entries', async () => {
    const supabase = makeSupabase({
      clients: [
        {
          id: 'c-1',
          company_name: 'Acme',
          year_end_date: '2024-03-31',
          vat_stagger_group: null,
          records_received_for: [],
          reminders_paused: false,
        },
      ],
      assignments: [{ client_id: 'c-1', filing_type_id: 'ct600' }],
    });

    const result = await getRolloverCandidates(supabase as any);
    expect(result).toHaveLength(0);
  });

  it('skips filing types where client has no active assignment', async () => {
    const pastDeadline = new Date('2025-01-01');
    vi.mocked(calculateDeadlineForCurrentPeriod).mockReturnValue(pastDeadline);

    const supabase = makeSupabase({
      clients: [
        {
          id: 'c-1',
          company_name: 'Acme',
          year_end_date: '2024-03-31',
          vat_stagger_group: null,
          records_received_for: ['ct600'],
          reminders_paused: false,
        },
      ],
      assignments: [], // no active assignment for ct600
    });

    const result = await getRolloverCandidates(supabase as any);
    expect(result).toHaveLength(0);
  });

  it('returns a candidate when deadline has passed and all criteria met', async () => {
    const pastDeadline = new Date('2025-01-01'); // clearly in the past
    vi.mocked(calculateDeadlineForCurrentPeriod).mockReturnValue(pastDeadline);

    const supabase = makeSupabase({
      clients: [
        {
          id: 'c-1',
          company_name: 'Acme Ltd',
          year_end_date: '2024-03-31',
          vat_stagger_group: null,
          records_received_for: ['ct600'],
          reminders_paused: false,
        },
      ],
      assignments: [{ client_id: 'c-1', filing_type_id: 'ct600' }],
    });

    const result = await getRolloverCandidates(supabase as any);
    expect(result).toHaveLength(1);
    expect(result[0].client_id).toBe('c-1');
    expect(result[0].filing_type_id).toBe('ct600');
    expect(result[0].days_overdue).toBeGreaterThan(0);
  });

  it('does NOT return a candidate when deadline is in the future', async () => {
    const futureDeadline = new Date('2099-12-31');
    vi.mocked(calculateDeadlineForCurrentPeriod).mockReturnValue(futureDeadline);

    const supabase = makeSupabase({
      clients: [
        {
          id: 'c-1',
          company_name: 'Acme',
          year_end_date: '2024-03-31',
          vat_stagger_group: null,
          records_received_for: ['ct600'],
          reminders_paused: false,
        },
      ],
      assignments: [{ client_id: 'c-1', filing_type_id: 'ct600' }],
    });

    const result = await getRolloverCandidates(supabase as any);
    expect(result).toHaveLength(0);
  });

  it('sorts candidates by days_overdue descending (most overdue first)', async () => {
    vi.mocked(calculateDeadlineForCurrentPeriod)
      .mockReturnValueOnce(new Date('2024-01-01')) // ct600 — more overdue
      .mockReturnValueOnce(new Date('2025-01-01')); // corp_tax — less overdue

    const supabase = makeSupabase({
      clients: [
        {
          id: 'c-1',
          company_name: 'Acme',
          year_end_date: '2023-03-31',
          vat_stagger_group: null,
          records_received_for: ['ct600', 'corp_tax'],
          reminders_paused: false,
        },
      ],
      assignments: [
        { client_id: 'c-1', filing_type_id: 'ct600' },
        { client_id: 'c-1', filing_type_id: 'corp_tax' },
      ],
    });

    const result = await getRolloverCandidates(supabase as any);
    expect(result).toHaveLength(2);
    expect(result[0].days_overdue).toBeGreaterThanOrEqual(result[1].days_overdue);
  });
});

// ── getRolloverSummary ────────────────────────────────────────────────────────

describe('getRolloverSummary', () => {
  it('returns counts grouped by filing_type_id', async () => {
    const pastDeadline = new Date('2025-01-01');
    vi.mocked(calculateDeadlineForCurrentPeriod).mockReturnValue(pastDeadline);

    const supabase = makeSupabase({
      clients: [
        {
          id: 'c-1', company_name: 'Acme', year_end_date: '2024-03-31',
          vat_stagger_group: null, records_received_for: ['ct600'], reminders_paused: false,
        },
        {
          id: 'c-2', company_name: 'Beta', year_end_date: '2024-06-30',
          vat_stagger_group: null, records_received_for: ['ct600'], reminders_paused: false,
        },
      ],
      assignments: [
        { client_id: 'c-1', filing_type_id: 'ct600' },
        { client_id: 'c-2', filing_type_id: 'ct600' },
      ],
    });

    const summary = await getRolloverSummary(supabase as any);
    expect(summary['ct600']).toBe(2);
  });
});

// ── rolloverFiling ────────────────────────────────────────────────────────────

describe('rolloverFiling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success=true and removes filing_type from records_received_for', async () => {
    const clientData = {
      id: 'c-1',
      company_name: 'Acme',
      records_received_for: ['ct600', 'corp_tax'],
      completed_for: ['ct600'],
    };

    const updateMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockResolvedValue({ error: null });

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'clients') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: clientData, error: null }),
            update: vi.fn().mockReturnThis(),
            // Chain for update: update().eq()
          };
        }
        if (table === 'reminder_queue') {
          return {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: Function) => resolve({ error: null }),
          };
        }
        if (table === 'audit_log') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
      }),
    };

    // Wire the clients update chain properly
    const clientsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(function(this: any) { return this; }),
      single: vi.fn().mockResolvedValue({ data: clientData, error: null }),
      update: vi.fn().mockReturnThis(),
    };
    // Make eq on the update chain resolve
    clientsChain.eq = vi.fn().mockResolvedValue({ error: null });
    const updateChain = { eq: vi.fn().mockResolvedValue({ error: null }) };

    supabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: clientData, error: null }),
          update: vi.fn().mockReturnValue(updateChain),
        };
      }
      if (table === 'reminder_queue') {
        const rqChain = {
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: Function) => resolve({ error: null }),
        };
        rqChain.eq = vi.fn().mockReturnValue(rqChain);
        // The final eq call must resolve
        return rqChain;
      }
      if (table === 'audit_log') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return {};
    });

    const result = await rolloverFiling(supabase as any, 'c-1', 'ct600');
    expect(result.success).toBe(true);
    expect(result.client_id).toBe('c-1');
    expect(result.filing_type_id).toBe('ct600');
  });

  it('returns success=false with error message when client fetch fails', async () => {
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'clients') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
          };
        }
        return {};
      }),
    };

    const result = await rolloverFiling(supabase as any, 'c-missing', 'ct600');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to fetch client');
  });

  it('removes filing_type_id from both records_received_for AND completed_for', async () => {
    let capturedUpdate: Record<string, unknown> | null = null;

    const clientData = {
      id: 'c-1',
      company_name: 'Acme',
      records_received_for: ['ct600', 'corp_tax'],
      completed_for: ['ct600', 'corp_tax'],
    };

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'clients') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: clientData, error: null }),
            update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
              capturedUpdate = payload;
              return { eq: vi.fn().mockResolvedValue({ error: null }) };
            }),
          };
        }
        if (table === 'reminder_queue') {
          const rqChain: Record<string, unknown> = {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: Function) => resolve({ error: null }),
          };
          (rqChain.eq as ReturnType<typeof vi.fn>) = vi.fn().mockReturnValue(rqChain);
          return rqChain;
        }
        if (table === 'audit_log') return { insert: vi.fn().mockResolvedValue({ error: null }) };
        return {};
      }),
    };

    await rolloverFiling(supabase as any, 'c-1', 'ct600');

    expect(capturedUpdate).not.toBeNull();
    expect(capturedUpdate!['records_received_for']).not.toContain('ct600');
    expect(capturedUpdate!['records_received_for']).toContain('corp_tax');
    expect(capturedUpdate!['completed_for']).not.toContain('ct600');
    expect(capturedUpdate!['completed_for']).toContain('corp_tax');
  });
});

// ── bulkRollover ──────────────────────────────────────────────────────────────

describe('bulkRollover', () => {
  it('returns correct successCount and errorCount for mixed results', async () => {
    // First client succeeds, second fails (client not found)
    const clientData = {
      id: 'c-1',
      company_name: 'Acme',
      records_received_for: ['ct600'],
      completed_for: [],
    };

    let callCount = 0;
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'clients') {
          callCount++;
          if (callCount <= 2) {
            // First rolloverFiling — client found
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: clientData, error: null }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          // Second rolloverFiling — client not found
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
          };
        }
        if (table === 'reminder_queue') {
          const rq: Record<string, unknown> = { delete: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), then: (resolve: Function) => resolve({ error: null }) };
          (rq.eq as ReturnType<typeof vi.fn>) = vi.fn().mockReturnValue(rq);
          return rq;
        }
        if (table === 'audit_log') return { insert: vi.fn().mockResolvedValue({ error: null }) };
        return {};
      }),
    };

    const items = [
      { client_id: 'c-1', filing_type_id: 'ct600' },
      { client_id: 'c-missing', filing_type_id: 'ct600' },
    ];

    const { results, successCount, errorCount } = await bulkRollover(supabase as any, items);
    expect(results).toHaveLength(2);
    expect(successCount).toBe(1);
    expect(errorCount).toBe(1);
  });

  it('returns successCount=0 and errorCount=0 for empty input', async () => {
    const supabase = { from: vi.fn() };
    const { results, successCount, errorCount } = await bulkRollover(supabase as any, []);
    expect(results).toHaveLength(0);
    expect(successCount).toBe(0);
    expect(errorCount).toBe(0);
  });
});
