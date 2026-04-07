import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processRemindersForUser } from './scheduler';
import type { Org } from './queue-builder';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('./queue-builder', () => ({
  buildReminderQueue: vi.fn().mockResolvedValue({ created: 0, skipped: 0 }),
  buildCustomScheduleQueue: vi.fn().mockResolvedValue({ created: 0, skipped: 0 }),
}));

vi.mock('@/lib/email/render-tiptap', () => ({
  renderTipTapEmail: vi.fn().mockResolvedValue({
    subject: 'Test Subject',
    text: 'Plain text body',
    html: '<p>HTML body</p>',
  }),
}));

vi.mock('@/lib/deadlines/rollover', () => ({
  rolloverDeadline: vi.fn().mockReturnValue(new Date('2027-01-01')),
}));

vi.mock('@/lib/documents/checklist', () => ({
  resolveDocumentsRequired: vi.fn().mockResolvedValue(''),
}));

// ── Constants ─────────────────────────────────────────────────────────────────

const ORG: Org = { id: 'org-1', name: 'Test Org', client_portal_enabled: false };
const USER_ID = 'user-abc';

// ── Mock factory helpers ──────────────────────────────────────────────────────

/**
 * A locks table mock that correctly handles:
 *  - insert({ id, org_id, expires_at }) → lock acquisition
 *  - delete().eq('id', lockId) → lock release in `finally` block
 */
function makeLocksMock(opts: { insertError?: unknown; insertThrows?: boolean } = {}) {
  const releaseChain = { eq: vi.fn().mockResolvedValue({ error: null }) };
  return {
    insert: opts.insertThrows
      ? vi.fn().mockRejectedValue(new Error('network timeout'))
      : vi.fn().mockResolvedValue({ error: opts.insertError ?? null }),
    delete: vi.fn().mockReturnValue(releaseChain),
  };
}

function makeAppSettingsMock(sendHour: number | null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(
      sendHour !== null
        ? { data: { value: String(sendHour) }, error: null }
        : { data: null, error: null }
    ),
  };
}

/**
 * Build a reminder_queue mock that:
 *  - On the FIRST from('reminder_queue') call: resolves with dueResult
 *  - On the SECOND from('reminder_queue') call: resolves with pastResult (via .order())
 *
 * The trick: the due-reminders query ends at .eq(...) and the past-deadlines
 * query ends at .order(...). We make `order` return the past result and
 * the shared chain resolve via a Promise for the due query.
 */
function makeReminderQueueFactory(
  dueResult: { data: unknown; error: unknown },
  pastResult: { data: unknown; error: unknown }
) {
  let callIndex = 0;

  return () => {
    callIndex++;

    if (callIndex === 1) {
      // First call: due reminders query — ends with .eq('status', 'scheduled')
      // We resolve it as a Promise directly from the chain object
      const chain: Record<string, unknown> = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ error: null }),
      };
      // Make the chain thenable so `await chain` resolves with dueResult
      (chain as any)[Symbol.toStringTag] = 'Promise';
      (chain as any).then = (resolve: Function) => Promise.resolve(dueResult).then(resolve);
      (chain as any).catch = (reject: Function) => Promise.resolve(dueResult).catch(reject);
      (chain as any).finally = (fn: Function) => Promise.resolve(dueResult).finally(fn);
      return chain;
    }

    // Second call: past deadlines query — ends with .order('deadline_date', ...)
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue(pastResult),
    };
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('processRemindersForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  it('returns early with lock error message when lock insert fails (duplicate lock)', async () => {
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'locks') return makeLocksMock({ insertError: { message: 'duplicate key' } });
        return {};
      }),
    };

    const result = await processRemindersForUser(supabase as any, ORG, USER_ID);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Lock already held');
    expect(result.queued).toBe(0);
  });

  it('includes error in result when lock acquisition throws unexpectedly', async () => {
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'locks') return makeLocksMock({ insertThrows: true });
        return {};
      }),
    };

    const result = await processRemindersForUser(supabase as any, ORG, USER_ID);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Failed to acquire lock');
  });

  it('sets skipped_wrong_hour=true when send_hour=25 (impossible hour)', async () => {
    // send_hour=25 can never match the real clock (valid hours are 0-23)
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'locks') return makeLocksMock();
        if (table === 'app_settings') return makeAppSettingsMock(25);
        if (table === 'schedules') {
          // Custom schedules query — no matches for send_hour=25
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: Function) => Promise.resolve({ data: [], error: null }).then(resolve),
            catch: (reject: Function) => Promise.resolve({ data: [], error: null }).catch(reject),
            finally: (fn: Function) => Promise.resolve({ data: [], error: null }).finally(fn),
          };
        }
        return {};
      }),
    };

    const result = await processRemindersForUser(supabase as any, ORG, USER_ID);

    expect(result.skipped_wrong_hour).toBe(true);
    expect(result.queued).toBe(0);
  });

  it('uses org-level send_hour fallback when no user-specific setting exists', async () => {
    let appSettingsCallCount = 0;

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'locks') return makeLocksMock();
        if (table === 'app_settings') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockImplementation(() => {
              appSettingsCallCount++;
              // First call = user-specific setting (none), second = org-level fallback
              if (appSettingsCallCount === 1) return Promise.resolve({ data: null, error: null });
              return Promise.resolve({ data: { value: '25' }, error: null }); // hour=25 → skip
            }),
          };
        }
        if (table === 'schedules') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: Function) => Promise.resolve({ data: [], error: null }).then(resolve),
            catch: (reject: Function) => Promise.resolve({ data: [], error: null }).catch(reject),
            finally: (fn: Function) => Promise.resolve({ data: [], error: null }).finally(fn),
          };
        }
        return {};
      }),
    };

    const result = await processRemindersForUser(supabase as any, ORG, USER_ID);

    // Both user-specific and org-level settings should be queried
    expect(appSettingsCallCount).toBeGreaterThanOrEqual(2);
    // Hour 25 never matches → skipped
    expect(result.skipped_wrong_hour).toBe(true);
  });

  it('returns zero queued and no errors when no due reminders exist', async () => {
    // Use hour=25 so we skip immediately — this is the simplest way to avoid
    // needing to know the real UK hour while still testing the no-reminders path
    // BUT: we need hour to match so we DON'T skip. Instead, test the path where
    // the due reminders query returns empty.
    // We make customHourSchedules non-empty so isGlobalHour check is bypassed.
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'locks') return makeLocksMock();
        if (table === 'app_settings') return makeAppSettingsMock(25); // global hour = 25
        if (table === 'schedules') {
          // Return a custom schedule matching the current real hour
          const currentHour = new Date().getUTCHours();
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: Function) => Promise.resolve({ data: [{ id: 'sched-1', send_hour: currentHour }], error: null }).then(resolve),
            catch: (reject: Function) => Promise.resolve({ data: [{ id: 'sched-1', send_hour: currentHour }], error: null }).catch(reject),
            finally: (fn: Function) => Promise.resolve({ data: [{ id: 'sched-1', send_hour: currentHour }], error: null }).finally(fn),
          };
        }
        if (table === 'reminder_queue') {
          const factory = makeReminderQueueFactory(
            { data: [], error: null },
            { data: [], error: null }
          );
          return factory();
        }
        return {};
      }),
    };

    const result = await processRemindersForUser(supabase as any, ORG, USER_ID);

    expect(result.queued).toBe(0);
    expect(result.skipped_wrong_hour).toBe(false);
    expect(result.errors).toHaveLength(0);
  });

  it('returns error when due reminders fetch fails (DB unavailable)', async () => {
    // Use global hour=25 + a custom schedule matching the real current hour
    // so we bypass the hour check and reach the reminder_queue fetch.
    const currentHour = new Date().getUTCHours();
    const customSchedule = { id: 'sched-db-test', send_hour: currentHour, name: 'Test', is_active: true };

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'locks') return makeLocksMock();
        if (table === 'app_settings') return makeAppSettingsMock(25); // global=25, custom hour triggers
        if (table === 'schedules') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: Function) => Promise.resolve({ data: [customSchedule], error: null }).then(resolve),
            catch: (reject: Function) => Promise.resolve({ data: [customSchedule], error: null }).catch(reject),
            finally: (fn: Function) => Promise.resolve({ data: [customSchedule], error: null }).finally(fn),
          };
        }
        if (table === 'reminder_queue') {
          // The due-reminders query is thenable and resolves with an error
          const chain: Record<string, unknown> = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            lt: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
          (chain as any).then = (resolve: Function) =>
            Promise.resolve({ data: null, error: { message: 'connection refused' } }).then(resolve);
          (chain as any).catch = (reject: Function) =>
            Promise.resolve({ data: null, error: { message: 'connection refused' } }).catch(reject);
          (chain as any).finally = (fn: Function) =>
            Promise.resolve({ data: null, error: { message: 'connection refused' } }).finally(fn);
          return chain;
        }
        return {};
      }),
    };

    const result = await processRemindersForUser(supabase as any, ORG, USER_ID);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Failed to fetch due reminders');
  });

  it('filters filing reminders to global hour; custom-hour reminders pass through', async () => {
    // Global hour=25 (never matches). Custom schedule matches current real hour.
    // Filing reminder (filing_type_id set) → filtered OUT.
    // Custom reminder (template_id matches custom schedule) → INCLUDED.
    const currentHour = new Date().getUTCHours();
    const customSchedule = { id: 'sched-custom', send_hour: currentHour, name: 'Monthly Check-in', is_active: true };

    const filingReminder = {
      id: 'rem-filing', filing_type_id: 'ct600', template_id: null, step_index: 1,
      send_date: '2026-04-06', deadline_date: '2026-04-30', status: 'scheduled', client_id: 'c-1',
      clients: { id: 'c-1', company_name: 'Acme Ltd', year_end_date: '2025-03-31', vat_stagger_group: null },
      filing_types: { id: 'ct600', name: 'CT600' },
    };
    const customReminder = {
      id: 'rem-custom', filing_type_id: null, template_id: 'sched-custom', step_index: 1,
      send_date: '2026-04-06', deadline_date: null, status: 'scheduled', client_id: 'c-1',
      clients: { id: 'c-1', company_name: 'Acme Ltd', year_end_date: '2025-03-31', vat_stagger_group: null },
      filing_types: null,
    };

    let capturedUpdateIds: string[] = [];

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'locks') return makeLocksMock();
        if (table === 'app_settings') return makeAppSettingsMock(25); // global=25
        if (table === 'schedules') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: customSchedule, error: null }),
            then: (resolve: Function) => Promise.resolve({ data: [customSchedule], error: null }).then(resolve),
            catch: (reject: Function) => Promise.resolve({ data: [customSchedule], error: null }).catch(reject),
            finally: (fn: Function) => Promise.resolve({ data: [customSchedule], error: null }).finally(fn),
          };
        }
        if (table === 'schedule_steps') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [{ step_number: 1, delay_days: 14, email_template_id: 'tmpl-1' }],
              error: null,
            }),
          };
        }
        if (table === 'email_templates') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'tmpl-1', subject: 'Hi {{client_name}}', body_json: {} },
              error: null,
            }),
          };
        }
        if (table === 'reminder_queue') {
          // Return a mock where we can intercept the update().in() call
          const updateInChain = {
            in: vi.fn().mockImplementation((field: string, ids: string[]) => {
              if (field === 'id') capturedUpdateIds = ids;
              return Promise.resolve({ error: null });
            }),
          };
          const dueChain: Record<string, unknown> = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            lt: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null }), // past deadlines = empty
            update: vi.fn().mockReturnValue(updateInChain),
          };
          (dueChain as any).then = (resolve: Function) =>
            Promise.resolve({ data: [filingReminder, customReminder], error: null }).then(resolve);
          (dueChain as any).catch = (reject: Function) =>
            Promise.resolve({ data: [filingReminder, customReminder], error: null }).catch(reject);
          (dueChain as any).finally = (fn: Function) =>
            Promise.resolve({ data: [filingReminder, customReminder], error: null }).finally(fn);
          return dueChain;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: Function) => Promise.resolve({ data: null, error: null }).then(resolve),
        };
      }),
    };

    const result = await processRemindersForUser(supabase as any, ORG, USER_ID);

    // Only the custom reminder passes the hour filter
    expect(result.queued).toBe(1);
    expect(capturedUpdateIds).toEqual(['rem-custom']);
  });

  /**
   * Build a fully-wired Supabase mock that drives processRemindersForUser
   * all the way through to step 8 (rollover detection).
   *
   * Due reminders are intentionally empty so the template-rendering loop is
   * skipped (the renderTipTapEmail mock already handles that). The past
   * deadlines fixture is what exercises the rollover logic.
   *
   * Key insight: the scheduler returns early at step 4 if due reminders are
   * empty. To reach step 8, we must pass due reminders through the filter.
   * We supply one custom reminder whose template_id matches a custom schedule
   * matching the current hour, so it passes the filter — but its schedule
   * lookup deliberately returns an error, allowing processing to continue
   * to step 8 after logging an error (the early-return at line 179 only
   * triggers on an UPDATE error, not on template rendering failures).
   */
  function buildRolloverTestSupabase(pastDeadlines: unknown[]) {
    const currentHour = new Date().getUTCHours();
    const customSchedule = { id: 'sched-x', send_hour: currentHour, name: 'Test', is_active: true };

    // A custom reminder that passes the hour filter (template_id matches custom schedule)
    const customReminder = {
      id: 'rem-due', filing_type_id: null, template_id: 'sched-x', step_index: 1,
      send_date: '2026-04-06', deadline_date: null, status: 'scheduled', client_id: 'c-due',
      clients: { id: 'c-due', company_name: 'Due Co', year_end_date: null, vat_stagger_group: null },
      filing_types: null,
    };

    // The scheduler makes these reminder_queue calls (in order):
    //   Call 1: SELECT due reminders (thenable chain ending after .eq('status', 'scheduled'))
    //   Call 2: UPDATE queued_at (.update({...}).in('id', [...]))
    //   Call 3: SELECT past deadlines (ends with .order('deadline_date', ...))
    let rqCallCount = 0;

    return {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'locks') return makeLocksMock();
        if (table === 'app_settings') return makeAppSettingsMock(25); // global=25; custom hour triggers
        if (table === 'schedules') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            // Thenable: used for the custom-hour schedules check
            then: (resolve: Function) => Promise.resolve({ data: [customSchedule], error: null }).then(resolve),
            catch: (reject: Function) => Promise.resolve({ data: [customSchedule], error: null }).catch(reject),
            finally: (fn: Function) => Promise.resolve({ data: [customSchedule], error: null }).finally(fn),
            // single(): used for the per-reminder schedule lookup — return error to skip rendering
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'no schedule' } }),
          };
        }
        if (table === 'reminder_queue') {
          rqCallCount++;
          if (rqCallCount === 1) {
            // Call 1: due reminders SELECT — resolved via thenable
            const chain: Record<string, unknown> = {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              lt: vi.fn().mockReturnThis(),
              not: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({ data: pastDeadlines, error: null }),
            };
            (chain as any).then = (resolve: Function) =>
              Promise.resolve({ data: [customReminder], error: null }).then(resolve);
            (chain as any).catch = (reject: Function) =>
              Promise.resolve({ data: [customReminder], error: null }).catch(reject);
            (chain as any).finally = (fn: Function) =>
              Promise.resolve({ data: [customReminder], error: null }).finally(fn);
            return chain;
          }
          if (rqCallCount === 2) {
            // Call 2: UPDATE queued_at — update().in()
            return {
              update: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          // Call 3: past deadlines SELECT — ends with .order(...)
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            lt: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: pastDeadlines, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          then: (resolve: Function) => Promise.resolve({ data: null, error: null }).then(resolve),
        };
      }),
    };
  }

  it('increments rolled_over count for each unique past deadline', async () => {
    const pastDeadlines = [
      {
        id: 'rem-past-1', client_id: 'c-1', filing_type_id: 'ct600',
        deadline_date: '2025-01-01', status: 'sent',
        clients: { id: 'c-1', company_name: 'Acme', year_end_date: '2024-03-31', vat_stagger_group: null },
      },
      {
        id: 'rem-past-2', client_id: 'c-2', filing_type_id: 'corp_tax',
        deadline_date: '2025-02-01', status: 'sent',
        clients: { id: 'c-2', company_name: 'Beta Co', year_end_date: '2024-06-30', vat_stagger_group: null },
      },
    ];

    const supabase = buildRolloverTestSupabase(pastDeadlines);
    const result = await processRemindersForUser(supabase as any, ORG, USER_ID);

    expect(result.rolled_over).toBe(2);
  });

  it('de-duplicates past deadlines by client+filing_type key before rolling over', async () => {
    // Two sent reminders for same client + filing_type — should only roll over once
    const pastDeadlines = [
      {
        id: 'rem-1', client_id: 'c-1', filing_type_id: 'ct600',
        deadline_date: '2025-01-01', status: 'sent',
        clients: { id: 'c-1', company_name: 'Acme', year_end_date: '2024-03-31', vat_stagger_group: null },
      },
      {
        id: 'rem-2', client_id: 'c-1', filing_type_id: 'ct600',
        deadline_date: '2024-01-01', status: 'sent',
        clients: { id: 'c-1', company_name: 'Acme', year_end_date: '2024-03-31', vat_stagger_group: null },
      },
    ];

    const supabase = buildRolloverTestSupabase(pastDeadlines);
    const result = await processRemindersForUser(supabase as any, ORG, USER_ID);

    // Only 1 rollover despite 2 records with the same client+filing_type key
    expect(result.rolled_over).toBe(1);
  });
});
