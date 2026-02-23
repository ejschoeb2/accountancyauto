import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendRetentionFlaggedEmail } from '@/lib/documents/notifications';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // Verify Vercel CRON_SECRET
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
    return NextResponse.json({ error: 'DB query failed' }, { status: 500 });
  }

  if (!expiredDocs || expiredDocs.length === 0) {
    console.log('[Retention Cron] No documents to flag');
    return NextResponse.json({ flagged: 0, orgsNotified: 0 });
  }

  // Set retention_flagged = true (batch update by IDs — never auto-delete)
  const { error: updateError } = await supabase
    .from('client_documents')
    .update({ retention_flagged: true })
    .in('id', expiredDocs.map(d => d.id));

  if (updateError) {
    console.error('[Retention Cron] Failed to flag documents:', updateError);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
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
  return NextResponse.json({ flagged: expiredDocs.length, orgsNotified });
}
