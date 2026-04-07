import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { sendRetentionFlaggedEmail } from '@/lib/documents/notifications';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // AUDIT-025: Execution metadata
  const executionId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  // AUDIT-007: Timing-safe auth
  const authHeader = request.headers.get('authorization') || '';
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  const isAuthorized =
    authHeader.length === expectedAuth.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedAuth));
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  // Find all unflagged, non-held documents past their retention deadline
  // Idempotency: WHERE retention_flagged = false ensures re-running never re-flags
  const { data: expiredDocs, error: fetchError } = await supabase
    .from('client_documents')
    .select('id, org_id, client_id, original_filename, filing_type_id, retain_until, clients(company_name, display_name)')
    .lt('retain_until', now)
    .eq('retention_hold', false)
    .eq('retention_flagged', false);

  if (fetchError) {
    console.error('[Retention Cron] Failed to fetch expired docs:', fetchError);
    return NextResponse.json({
      execution_id: executionId,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      error: 'DB query failed',
    }, { status: 500 });
  }

  if (!expiredDocs || expiredDocs.length === 0) {
    console.log('[Retention Cron] No documents to flag');
    return NextResponse.json({
      execution_id: executionId,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      flagged: 0,
      orgsNotified: 0,
    });
  }

  // Set retention_flagged = true (batch update by IDs — never auto-delete)
  const { error: updateError } = await supabase
    .from('client_documents')
    .update({ retention_flagged: true })
    .in('id', expiredDocs.map(d => d.id));

  if (updateError) {
    console.error('[Retention Cron] Failed to flag documents:', updateError);
    return NextResponse.json({
      execution_id: executionId,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      error: 'Update failed',
    }, { status: 500 });
  }

  // Group newly flagged docs by org_id and notify each org's admin
  const byOrg = expiredDocs.reduce<Record<string, typeof expiredDocs>>((acc, doc) => {
    if (!acc[doc.org_id]) acc[doc.org_id] = [];
    acc[doc.org_id].push(doc);
    return acc;
  }, {});

  let orgsNotified = 0;
  for (const [orgId, docs] of Object.entries(byOrg)) {
    try {
      // Normalise the PostgREST array-join result to match FlaggedDocument shape
      // PostgREST returns clients as array; pick first element (each document has one client)
      const normalised = docs.map(d => ({
        id: d.id as string,
        original_filename: d.original_filename as string,
        filing_type_id: d.filing_type_id as string,
        retain_until: d.retain_until as string,
        clients: Array.isArray(d.clients) ? (d.clients[0] ?? null) : (d.clients as { company_name: string | null; display_name: string | null } | null),
      }));
      await sendRetentionFlaggedEmail(orgId, normalised, supabase);
      orgsNotified++;
    } catch (err) {
      console.error(`[Retention Cron] Failed to email org ${orgId}:`, err);
    }
  }

  console.log(`[Retention Cron] Flagged ${expiredDocs.length} documents across ${orgsNotified} orgs`);
  return NextResponse.json({
    execution_id: executionId,
    started_at: startedAt,
    ended_at: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
    flagged: expiredDocs.length,
    orgsNotified,
  });
}
