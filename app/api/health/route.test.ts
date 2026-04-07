import { describe, it, expect, vi, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createServiceClient } from '@/lib/supabase/service';
import { GET } from './route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a Supabase mock whose .from().select().limit() resolves with `result` */
function buildServiceClientMock(result: { data?: unknown; error?: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
  return { from: vi.fn().mockReturnValue(chain) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/health', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with status "healthy" when DB is reachable', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      buildServiceClientMock({ data: [{ id: 'org-1' }], error: null }) as any
    );

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.timestamp).toBeDefined();
    expect(body.checks.database.status).toBe('ok');
    expect(typeof body.checks.database.latency_ms).toBe('number');
  });

  it('returns 503 with status "degraded" when DB query returns an error', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      buildServiceClientMock({ data: null, error: { message: 'connection refused' } }) as any
    );

    const res = await GET();

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe('degraded');
    expect(body.checks.database.status).toBe('error');
    expect(body.checks.database.error).toBe('Database unreachable');
  });

  it('returns 503 with status "degraded" when createServiceClient throws', async () => {
    vi.mocked(createServiceClient).mockImplementation(() => {
      throw new Error('Cannot connect to Supabase');
    });

    const res = await GET();

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe('degraded');
    expect(body.checks.database.status).toBe('error');
  });

  it('response always includes a timestamp field', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      buildServiceClientMock({ data: [], error: null }) as any
    );

    const res = await GET();
    const body = await res.json();

    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('database check reports latency_ms as a non-negative number when healthy', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      buildServiceClientMock({ data: [{ id: 'org-1' }], error: null }) as any
    );

    const res = await GET();
    const body = await res.json();

    expect(body.checks.database.latency_ms).toBeGreaterThanOrEqual(0);
  });
});
