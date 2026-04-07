import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted before any imports that use them
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/reminders/scheduler', () => ({
  processRemindersForUser: vi.fn(),
}));

vi.mock('@/lib/email/sender', () => ({
  sendRichEmailForOrg: vi.fn(),
}));

vi.mock('@/lib/email/circuit-breaker', () => ({
  sleepBackoff: vi.fn(),
  CircuitOpenError: class CircuitOpenError extends Error {},
  getCircuitState: vi.fn(() => 'CLOSED'),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock postmark for the critical-alert path
vi.mock('postmark', () => ({
  ServerClient: vi.fn().mockImplementation(() => ({
    sendEmail: vi.fn().mockResolvedValue({}),
  })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin';
import { processRemindersForUser } from '@/lib/reminders/scheduler';
import { GET as remindersGET } from './reminders/route';
import { GET as sendEmailsGET } from './send-emails/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createCronRequest(secret?: string, url = 'http://localhost:3000/api/cron/reminders'): Request {
  const headers = new Headers();
  if (secret !== undefined) {
    headers.set('authorization', `Bearer ${secret}`);
  }
  return new Request(url, { headers });
}

/** Build a minimal chainable Supabase mock that returns `returnValue` from `.in()` */
function buildSupabaseMock(orgsReturn: { data: unknown; error: unknown }) {
  const queryChain = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue(orgsReturn),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockResolvedValue({ error: null }),
    lt: vi.fn().mockReturnThis(),
  };
  return {
    from: vi.fn().mockReturnValue(queryChain),
    _chain: queryChain,
  };
}

// ---------------------------------------------------------------------------
// Test suite: GET /api/cron/reminders
// ---------------------------------------------------------------------------

describe('GET /api/cron/reminders', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'test-secret-reminders');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const req = createCronRequest(undefined);
    const res = await remindersGET(req as any);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when CRON_SECRET is wrong', async () => {
    const req = createCronRequest('wrong-secret');
    const res = await remindersGET(req as any);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 200 with execution metadata when secret is valid and no orgs exist', async () => {
    const mock = buildSupabaseMock({ data: [], error: null });
    vi.mocked(createAdminClient).mockReturnValue(mock as any);

    const req = createCronRequest('test-secret-reminders');
    const res = await remindersGET(req as any);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.execution_id).toBeDefined();
    expect(body.started_at).toBeDefined();
    expect(body.ended_at).toBeDefined();
    expect(typeof body.duration_ms).toBe('number');
    expect(body.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('response includes success flag and empty results when no orgs found', async () => {
    const mock = buildSupabaseMock({ data: [], error: null });
    vi.mocked(createAdminClient).mockReturnValue(mock as any);

    const req = createCronRequest('test-secret-reminders');
    const res = await remindersGET(req as any);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.results).toEqual([]);
    expect(body.message).toBe('No active organisations found');
  });

  it('returns 200 with org results when orgs exist and processRemindersForUser succeeds', async () => {
    const mockOrg = {
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      postmark_server_token: 'pm-token',
      client_portal_enabled: false,
    };

    const mockQueryChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [mockOrg], error: null }),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    };

    // members query
    const membersChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [{ user_id: 'user-1' }], error: null }),
    };

    const adminMock = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'organisations') return mockQueryChain;
        return membersChain;
      }),
    };

    vi.mocked(createAdminClient).mockReturnValue(adminMock as any);
    vi.mocked(processRemindersForUser).mockResolvedValue({
      queued: 3,
      rolled_over: 1,
      errors: [],
      skipped_wrong_hour: false,
    } as any);

    const req = createCronRequest('test-secret-reminders');
    const res = await remindersGET(req as any);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.orgs_processed).toBe(1);
    expect(body.total_queued).toBe(3);
    expect(body.total_rolled_over).toBe(1);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].org).toBe('Test Org');
  });

  it('returns 500 with execution metadata when Supabase is unreachable', async () => {
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error('Supabase connection refused');
    });

    const req = createCronRequest('test-secret-reminders');
    const res = await remindersGET(req as any);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.execution_id).toBeDefined();
    expect(body.started_at).toBeDefined();
    expect(body.ended_at).toBeDefined();
    expect(body.duration_ms).toBeGreaterThanOrEqual(0);
    expect(body.error).toBeDefined();
  });

  it('skips orgs without a Postmark token', async () => {
    const mockOrg = {
      id: 'org-no-pm',
      name: 'No Postmark Org',
      slug: 'no-pm',
      postmark_server_token: null,
      client_portal_enabled: false,
    };

    const mockQueryChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [mockOrg], error: null }),
    };

    const adminMock = { from: vi.fn().mockReturnValue(mockQueryChain) };
    vi.mocked(createAdminClient).mockReturnValue(adminMock as any);

    const req = createCronRequest('test-secret-reminders');
    const res = await remindersGET(req as any);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].error).toMatch(/Skipped/);
    expect(vi.mocked(processRemindersForUser)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test suite: GET /api/cron/send-emails
// ---------------------------------------------------------------------------

describe('GET /api/cron/send-emails', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'test-secret-emails');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const req = createCronRequest(undefined, 'http://localhost:3000/api/cron/send-emails');
    const res = await sendEmailsGET(req as any);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when CRON_SECRET is wrong', async () => {
    const req = createCronRequest('bad-secret', 'http://localhost:3000/api/cron/send-emails');
    const res = await sendEmailsGET(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 200 with execution metadata when secret is valid and no orgs exist', async () => {
    const mock = buildSupabaseMock({ data: [], error: null });
    vi.mocked(createAdminClient).mockReturnValue(mock as any);

    const req = createCronRequest('test-secret-emails', 'http://localhost:3000/api/cron/send-emails');
    const res = await sendEmailsGET(req as any);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.execution_id).toBeDefined();
    expect(body.started_at).toBeDefined();
    expect(body.ended_at).toBeDefined();
    expect(typeof body.duration_ms).toBe('number');
    expect(body.duration_ms).toBeGreaterThanOrEqual(0);
    expect(body.success).toBe(true);
    expect(body.results).toEqual([]);
  });

  it('returns 500 with execution metadata when Supabase is unreachable', async () => {
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error('DB connection failed');
    });

    const req = createCronRequest('test-secret-emails', 'http://localhost:3000/api/cron/send-emails');
    const res = await sendEmailsGET(req as any);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.execution_id).toBeDefined();
    expect(body.started_at).toBeDefined();
    expect(body.ended_at).toBeDefined();
    expect(body.duration_ms).toBeGreaterThanOrEqual(0);
    expect(body.error).toBeDefined();
  });

  it('skips orgs without a Postmark token in send-emails route', async () => {
    const mockOrg = {
      id: 'org-no-pm',
      name: 'No Token Org',
      slug: 'no-token',
      postmark_server_token: null,
      postmark_sender_domain: null,
    };

    const queryChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [mockOrg], error: null }),
    };
    const adminMock = { from: vi.fn().mockReturnValue(queryChain) };
    vi.mocked(createAdminClient).mockReturnValue(adminMock as any);

    const req = createCronRequest('test-secret-emails', 'http://localhost:3000/api/cron/send-emails');
    const res = await sendEmailsGET(req as any);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].errors[0].message).toMatch(/Skipped/);
  });
});
