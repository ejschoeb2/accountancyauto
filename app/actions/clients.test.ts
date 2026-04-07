import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks (must be declared before any imports that use them) ──────────

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/org-context', () => ({
  getOrgId: vi.fn().mockResolvedValue('org-1'),
  getOrgContext: vi.fn().mockResolvedValue({ orgId: 'org-1', orgRole: 'admin' }),
}));

vi.mock('@/lib/billing/read-only-mode', () => ({
  requireWriteAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/validations/client', () => ({
  updateClientMetadataSchema: {
    safeParse: vi.fn().mockReturnValue({ success: true, data: {} }),
  },
  clientTypeSchema: {},
}));

vi.mock('@/lib/dashboard/traffic-light', () => ({
  calculateFilingTypeStatus: vi.fn().mockReturnValue('green'),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/audit/log', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { getClients, updateClientMetadata, deleteClients, reassignClients } from './clients';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgId, getOrgContext } from '@/lib/auth/org-context';
import { requireWriteAccess } from '@/lib/billing/read-only-mode';
import { updateClientMetadataSchema } from '@/lib/validations/client';
import { writeAuditLog } from '@/lib/audit/log';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOCK_USER = { id: 'user-1' };

function mockSupabaseClient(overrides: Record<string, unknown> = {}) {
  const client = {
    from: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: MOCK_USER } }),
    },
    ...overrides,
  };
  vi.mocked(createClient).mockResolvedValue(client as any);
  return client;
}

function mockAdminClient(overrides: Record<string, unknown> = {}) {
  const admin = {
    from: vi.fn(),
    ...overrides,
  };
  vi.mocked(createAdminClient).mockReturnValue(admin as any);
  return admin;
}

// ── getClients ────────────────────────────────────────────────────────────────

describe('getClients', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns array of clients ordered by company_name', async () => {
    const clientsData = [
      { id: 'c-1', company_name: 'Acme Ltd' },
      { id: 'c-2', company_name: 'Beta Co' },
    ];

    const supabase = mockSupabaseClient();
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: clientsData, error: null }),
    });

    const result = await getClients();
    expect(result).toHaveLength(2);
    expect(result[0].company_name).toBe('Acme Ltd');
  });

  it('throws when Supabase returns an error', async () => {
    const supabase = mockSupabaseClient();
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'permission denied' } }),
    });

    await expect(getClients()).rejects.toThrow('Failed to fetch clients');
  });

  it('returns empty array when no clients exist', async () => {
    const supabase = mockSupabaseClient();
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const result = await getClients();
    expect(result).toEqual([]);
  });
});

// ── updateClientMetadata ──────────────────────────────────────────────────────

describe('updateClientMetadata', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates client and returns updated record', async () => {
    const updatedClient = { id: 'c-1', company_name: 'Acme Ltd', primary_email: 'new@acme.com' };

    vi.mocked(updateClientMetadataSchema.safeParse).mockReturnValue({
      success: true,
      data: { primary_email: 'new@acme.com' },
    } as any);

    const supabase = mockSupabaseClient();
    supabase.from.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedClient, error: null }),
    });

    const result = await updateClientMetadata('c-1', { primary_email: 'new@acme.com' });
    expect(result.primary_email).toBe('new@acme.com');
  });

  it('throws when Zod validation fails', async () => {
    vi.mocked(updateClientMetadataSchema.safeParse).mockReturnValue({
      success: false,
      error: { issues: [{ message: 'Invalid email format' }] },
    } as any);

    const supabase = mockSupabaseClient();
    supabase.from.mockReturnValue({});

    await expect(updateClientMetadata('c-1', { primary_email: 'bad' }))
      .rejects.toThrow('Validation failed');
  });

  it('throws when Supabase update fails', async () => {
    vi.mocked(updateClientMetadataSchema.safeParse).mockReturnValue({
      success: true,
      data: { primary_email: 'ok@example.com' },
    } as any);

    const supabase = mockSupabaseClient();
    supabase.from.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'constraint violation' } }),
    });

    await expect(updateClientMetadata('c-1', {})).rejects.toThrow('Failed to update client');
  });

  it('blocks update when requireWriteAccess throws (subscription inactive)', async () => {
    vi.mocked(requireWriteAccess).mockRejectedValueOnce(new Error('Subscription inactive'));

    const supabase = mockSupabaseClient();
    supabase.from.mockReturnValue({});

    await expect(updateClientMetadata('c-1', {})).rejects.toThrow('Subscription inactive');
  });

  it('writes audit log after successful update', async () => {
    vi.mocked(updateClientMetadataSchema.safeParse).mockReturnValue({
      success: true,
      data: { reminders_paused: true },
    } as any);

    const supabase = mockSupabaseClient();
    supabase.from.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'c-1' }, error: null }),
    });

    await updateClientMetadata('c-1', { reminders_paused: true });

    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update', table_name: 'clients', row_id: 'c-1' })
    );
  });
});

// ── deleteClients ─────────────────────────────────────────────────────────────

describe('deleteClients', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes clients by ids and returns success with count', async () => {
    const supabase = mockSupabaseClient();
    supabase.from.mockReturnValue({
      delete: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: null, count: 2 }),
    });

    const result = await deleteClients(['c-1', 'c-2']);
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
  });

  it('throws when Supabase delete fails', async () => {
    const supabase = mockSupabaseClient();
    supabase.from.mockReturnValue({
      delete: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: { message: 'delete failed' }, count: null }),
    });

    await expect(deleteClients(['c-1'])).rejects.toThrow('Failed to delete clients');
  });

  it('writes audit log with deleted client ids', async () => {
    const supabase = mockSupabaseClient();
    supabase.from.mockReturnValue({
      delete: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: null, count: 1 }),
    });

    await deleteClients(['c-1']);

    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'bulk_delete',
        table_name: 'clients',
        metadata: expect.objectContaining({ client_ids: ['c-1'] }),
      })
    );
  });
});

// ── reassignClients ───────────────────────────────────────────────────────────

describe('reassignClients', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when caller is not an admin', async () => {
    vi.mocked(getOrgContext).mockResolvedValueOnce({ orgId: 'org-1', orgRole: 'member' } as any);

    const result = await reassignClients('user-from', 'user-to');
    expect(result.error).toContain('Only admins');
  });

  it('returns error when source user is not in the org', async () => {
    const admin = mockAdminClient();
    admin.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), // not found
    });

    // createClient still needed for audit log
    const supabase = mockSupabaseClient();
    supabase.from.mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() });

    const result = await reassignClients('user-from-unknown', 'user-to');
    expect(result.error).toContain('Source accountant');
  });

  it('returns error when target user is not in the org', async () => {
    const admin = mockAdminClient();
    let memberCallCount = 0;
    admin.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(() => {
        memberCallCount++;
        // First call (from user) found, second call (to user) not found
        if (memberCallCount === 1) return Promise.resolve({ data: { user_id: 'user-from' }, error: null });
        return Promise.resolve({ data: null, error: null });
      }),
    });

    mockSupabaseClient();

    const result = await reassignClients('user-from', 'user-to-unknown');
    expect(result.error).toContain('Target accountant');
  });

  it('successfully reassigns clients and returns reassigned count', async () => {
    const admin = mockAdminClient();
    admin.from.mockImplementation((table: string) => {
      if (table === 'user_organisations') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { user_id: 'some-user' }, error: null }),
        };
      }
      if (table === 'clients') {
        // The chain is: .update({...}).eq('org_id', orgId).eq('owner_id', fromUserId)
        // The final .eq() resolves with { error, count }
        const secondEq = vi.fn().mockResolvedValue({ error: null, count: 5 });
        const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
        return {
          update: vi.fn().mockReturnValue({ eq: firstEq }),
        };
      }
      return {};
    });

    const supabase = mockSupabaseClient();
    supabase.from.mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() });

    const result = await reassignClients('user-from', 'user-to');
    expect(result.error).toBeUndefined();
    expect(result.reassigned).toBe(5);
  });
});
