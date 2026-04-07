/**
 * Tests for the Postmark webhook route (AUDIT-019)
 *
 * The route reads a raw body, verifies the HMAC-SHA256 signature, then
 * updates email_log for Delivery and Bounce events.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Control signature verification in each test
vi.mock('@/lib/webhooks/postmark-verify', () => ({
  verifyPostmarkWebhook: vi.fn(),
}));

// Control Supabase calls
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { POST } from './route';
import { verifyPostmarkWebhook } from '@/lib/webhooks/postmark-verify';
import { createAdminClient } from '@/lib/supabase/admin';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a mock Supabase client for the admin route. The route chains:
 *   supabase.from(...).update(...).eq(...)
 */
function makeAdminSupabase(updateError: object | null = null) {
  const eq = vi.fn().mockResolvedValue({ error: updateError });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  return { client: { from }, from, update, eq };
}

/** Build a minimal Request with the given body and optional signature header */
function makeRequest(body: object | string, signature = 'valid-sig'): Request {
  const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request('http://localhost/api/webhooks/postmark', {
    method: 'POST',
    body: rawBody,
    headers: {
      'Content-Type': 'application/json',
      'x-postmark-signature': signature,
    },
  });
}

/** Build a Request with no signature header */
function makeRequestNoSig(body: object): Request {
  return new Request('http://localhost/api/webhooks/postmark', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/webhooks/postmark', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.POSTMARK_WEBHOOK_SECRET = 'test-secret';
  });

  // ── Auth / validation ────────────────────────────────────────────────────

  it('returns 401 when x-postmark-signature header is missing', async () => {
    const req = makeRequestNoSig({ RecordType: 'Delivery' });

    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Missing signature');
  });

  it('returns 401 when signature verification fails', async () => {
    (verifyPostmarkWebhook as any).mockReturnValue(false);

    const res = await POST(makeRequest({ RecordType: 'Delivery' }));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid signature');
  });

  // ── Delivery event ───────────────────────────────────────────────────────

  it('updates email_log with delivered status for a Delivery event', async () => {
    (verifyPostmarkWebhook as any).mockReturnValue(true);
    const { client, from, update, eq } = makeAdminSupabase();
    (createAdminClient as any).mockReturnValue(client);

    const event = {
      RecordType: 'Delivery',
      MessageID: 'msg-abc-123',
      DeliveredAt: '2026-04-06T10:00:00Z',
    };

    const res = await POST(makeRequest(event));

    expect(res.status).toBe(200);
    expect(from).toHaveBeenCalledWith('email_log');
    expect(update).toHaveBeenCalledWith({
      delivery_status: 'delivered',
      delivered_at: event.DeliveredAt,
    });
    expect(eq).toHaveBeenCalledWith('postmark_message_id', 'msg-abc-123');
  });

  it('returns 200 even when the Supabase update for Delivery fails', async () => {
    (verifyPostmarkWebhook as any).mockReturnValue(true);
    const { client } = makeAdminSupabase({ message: 'DB write error' });
    (createAdminClient as any).mockReturnValue(client);

    const res = await POST(makeRequest({ RecordType: 'Delivery', MessageID: 'msg-x' }));

    expect(res.status).toBe(200);
  });

  // ── Bounce event ─────────────────────────────────────────────────────────

  it('sets delivery_status to "failed" for a HardBounce', async () => {
    (verifyPostmarkWebhook as any).mockReturnValue(true);
    const { client, update } = makeAdminSupabase();
    (createAdminClient as any).mockReturnValue(client);

    const event = {
      RecordType: 'Bounce',
      MessageID: 'msg-bounce-001',
      Type: 'HardBounce',
      Description: 'Recipient does not exist',
    };

    const res = await POST(makeRequest(event));

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      delivery_status: 'failed',
      bounce_type: 'HardBounce',
      bounce_description: 'Recipient does not exist',
    });
  });

  it('sets delivery_status to "bounced" for a SoftBounce', async () => {
    (verifyPostmarkWebhook as any).mockReturnValue(true);
    const { client, update } = makeAdminSupabase();
    (createAdminClient as any).mockReturnValue(client);

    const event = {
      RecordType: 'Bounce',
      MessageID: 'msg-bounce-002',
      Type: 'SoftBounce',
      Description: 'Mailbox full',
    };

    await POST(makeRequest(event));

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ delivery_status: 'bounced' })
    );
  });

  it('updates email_log using the correct MessageID for a Bounce event', async () => {
    (verifyPostmarkWebhook as any).mockReturnValue(true);
    const { client, eq } = makeAdminSupabase();
    (createAdminClient as any).mockReturnValue(client);

    const event = {
      RecordType: 'Bounce',
      MessageID: 'msg-bounce-003',
      Type: 'HardBounce',
      Description: 'Bad address',
    };

    await POST(makeRequest(event));

    expect(eq).toHaveBeenCalledWith('postmark_message_id', 'msg-bounce-003');
  });

  // ── Unknown event type ───────────────────────────────────────────────────

  it('returns 200 for an unhandled event type without updating email_log', async () => {
    (verifyPostmarkWebhook as any).mockReturnValue(true);
    const { client, from } = makeAdminSupabase();
    (createAdminClient as any).mockReturnValue(client);

    const res = await POST(makeRequest({ RecordType: 'SpamComplaint', MessageID: 'msg-spam' }));

    expect(res.status).toBe(200);
    // from() should not be called for unhandled types
    expect(from).not.toHaveBeenCalled();
  });

  // ── Acknowledged receipt ─────────────────────────────────────────────────

  it('always returns { received: true } in the response body on success', async () => {
    (verifyPostmarkWebhook as any).mockReturnValue(true);
    const { client } = makeAdminSupabase();
    (createAdminClient as any).mockReturnValue(client);

    const res = await POST(makeRequest({ RecordType: 'Delivery', MessageID: 'msg-ok' }));

    const body = await res.json();
    expect(body).toEqual({ received: true });
  });

  it('returns 200 even when processing inside the try/catch throws unexpectedly', async () => {
    (verifyPostmarkWebhook as any).mockReturnValue(true);
    // createAdminClient itself succeeds, but from() throws inside the switch —
    // that throw is caught by the route's try/catch and still returns 200.
    const crashingClient = {
      from: vi.fn().mockImplementation(() => {
        throw new Error('Unexpected crash inside switch');
      }),
    };
    (createAdminClient as any).mockReturnValue(crashingClient);

    const res = await POST(makeRequest({ RecordType: 'Delivery', MessageID: 'msg-crash' }));

    // Route catches errors inside the try block and always returns 200 to prevent Postmark retries
    expect(res.status).toBe(200);
  });
});
