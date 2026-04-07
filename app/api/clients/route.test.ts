import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/org-context', () => ({
  getOrgId: vi.fn().mockResolvedValue('org-test-123'),
}));

vi.mock('@/lib/billing/read-only-mode', () => ({
  requireWriteAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/billing/usage-limits', () => ({
  checkClientLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('@/lib/reminders/queue-builder', () => ({
  rebuildQueueForClient: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkClientLimit } from '@/lib/billing/usage-limits';
import { requireWriteAccess } from '@/lib/billing/read-only-mode';
import { GET, POST } from './route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost:3000/api/clients');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/clients', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Build a Supabase query chain that resolves `.range()` with the given value */
function buildSelectChain(returnValue: { data: unknown; error: unknown; count?: number | null }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(returnValue),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return chain;
}

// ---------------------------------------------------------------------------
// GET /api/clients
// ---------------------------------------------------------------------------

describe('GET /api/clients', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with client list and X-Total-Count header (default pagination)', async () => {
    const fakeClients = [
      { id: 'c1', company_name: 'Alpha Ltd', client_type: 'Limited Company' },
      { id: 'c2', company_name: 'Beta LLP', client_type: 'LLP' },
    ];
    const chain = buildSelectChain({ data: fakeClients, error: null, count: 2 });
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn().mockReturnValue(chain) } as any);

    const req = makeGetRequest();
    const res = await GET(req as any);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Total-Count')).toBe('2');
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].company_name).toBe('Alpha Ltd');
  });

  it('respects limit and offset query parameters', async () => {
    const chain = buildSelectChain({ data: [{ id: 'c3', company_name: 'Gamma Co', client_type: 'Individual' }], error: null, count: 50 });
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn().mockReturnValue(chain) } as any);

    const req = makeGetRequest({ limit: '10', offset: '20' });
    const res = await GET(req as any);

    expect(res.status).toBe(200);
    // Verify range was called with the correct offset/limit arithmetic
    expect(chain.range).toHaveBeenCalledWith(20, 29); // offset=20, offset+limit-1=29
    expect(res.headers.get('X-Total-Count')).toBe('50');
  });

  it('returns empty array with X-Total-Count 0 when no clients exist', async () => {
    const chain = buildSelectChain({ data: [], error: null, count: 0 });
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn().mockReturnValue(chain) } as any);

    const req = makeGetRequest();
    const res = await GET(req as any);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Total-Count')).toBe('0');
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('returns 500 when Supabase query returns an error', async () => {
    const chain = buildSelectChain({ data: null, error: { message: 'DB error' }, count: null });
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn().mockReturnValue(chain) } as any);

    const req = makeGetRequest();
    const res = await GET(req as any);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// POST /api/clients
// ---------------------------------------------------------------------------

describe('POST /api/clients', () => {
  const validPayload = {
    company_name: 'Test Client Ltd',
    primary_email: 'test@example.com',
    client_type: 'Limited Company',
    vat_registered: false,
  };

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('creates client and returns 201 with created data', async () => {
    const createdClient = { id: 'new-client-id', ...validPayload, org_id: 'org-test-123', owner_id: 'user-1' };

    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: createdClient, error: null }),
    };
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
    };

    const supabaseMock = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'clients') return insertChain;
        return selectChain;
      }),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
    };

    vi.mocked(createClient).mockResolvedValue(supabaseMock as any);
    vi.mocked(createAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(selectChain) } as any);

    const req = makePostRequest(validPayload);
    const res = await POST(req as any);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('new-client-id');
    expect(body.company_name).toBe('Test Client Ltd');
  });

  it('returns 400 when request body is invalid JSON', async () => {
    const req = new Request('http://localhost:3000/api/clients', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid JSON body');
  });

  it('returns 400 when required fields are missing', async () => {
    const req = makePostRequest({ company_name: 'Missing email' });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 when email is invalid', async () => {
    const req = makePostRequest({ ...validPayload, primary_email: 'not-an-email' });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 401 when user is not authenticated', async () => {
    const supabaseMock = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(supabaseMock as any);

    const req = makePostRequest(validPayload);
    const res = await POST(req as any);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Not authenticated');
  });

  it('returns 403 with CLIENT_LIMIT_REACHED code when plan limit is hit', async () => {
    const supabaseMock = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn(),
    };
    vi.mocked(createClient).mockResolvedValue(supabaseMock as any);
    vi.mocked(checkClientLimit).mockResolvedValue({
      allowed: false,
      message: 'You have reached your client limit',
      currentCount: 10,
      limit: 10,
    } as any);

    const req = makePostRequest(validPayload);
    const res = await POST(req as any);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('CLIENT_LIMIT_REACHED');
    expect(body.error).toBeDefined();
  });

  it('returns 403 when subscription is inactive (requireWriteAccess throws)', async () => {
    const supabaseMock = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn(),
    };
    vi.mocked(createClient).mockResolvedValue(supabaseMock as any);
    vi.mocked(requireWriteAccess).mockRejectedValue(new Error('Subscription inactive'));

    const req = makePostRequest(validPayload);
    const res = await POST(req as any);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Subscription inactive');
  });
});
