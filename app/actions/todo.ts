'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgId } from '@/lib/auth/org-context';
import { requireWriteAccess } from '@/lib/billing/read-only-mode';
import { rolloverFiling } from '@/lib/rollover/executor';

/**
 * Mark a filing as completed for a client (adds to completed_for array)
 * and logs it to filing_completion_log so the forecast can show green bars.
 */
export async function markFilingComplete(
  clientId: string,
  filingTypeId: string,
  deadlineDate: string | null
) {
  const orgId = await getOrgId();
  await requireWriteAccess(orgId);

  const supabase = await createClient();

  const { data: client, error: fetchError } = await supabase
    .from('clients')
    .select('completed_for')
    .eq('id', clientId)
    .single();

  if (fetchError || !client) {
    return { error: 'Client not found' };
  }

  const current: string[] = Array.isArray(client.completed_for) ? client.completed_for : [];
  if (current.includes(filingTypeId)) {
    return { success: true }; // already completed
  }

  const { error: updateError } = await supabase
    .from('clients')
    .update({ completed_for: [...current, filingTypeId] })
    .eq('id', clientId);

  if (updateError) {
    return { error: updateError.message };
  }

  // Log completion for forecast persistence
  if (deadlineDate) {
    await supabase.from('filing_completion_log').insert({
      org_id: orgId,
      client_id: clientId,
      filing_type_id: filingTypeId,
      deadline_date: deadlineDate,
    });
  }

  return { success: true };
}

/**
 * Revert a filing completion (removes from completed_for array and deletes the log entry).
 */
export async function revertFilingComplete(clientId: string, filingTypeId: string) {
  const orgId = await getOrgId();
  await requireWriteAccess(orgId);

  const supabase = await createClient();

  const { data: client, error: fetchError } = await supabase
    .from('clients')
    .select('completed_for')
    .eq('id', clientId)
    .single();

  if (fetchError || !client) {
    return { error: 'Client not found' };
  }

  const current: string[] = Array.isArray(client.completed_for) ? client.completed_for : [];

  const { error: updateError } = await supabase
    .from('clients')
    .update({ completed_for: current.filter((id) => id !== filingTypeId) })
    .eq('id', clientId);

  if (updateError) {
    return { error: updateError.message };
  }

  // Remove the completion log entry (most recent un-rolled-over one)
  await supabase
    .from('filing_completion_log')
    .delete()
    .eq('client_id', clientId)
    .eq('filing_type_id', filingTypeId)
    .is('rolled_over_at', null);

  return { success: true };
}

/**
 * Roll over a filing to the next cycle (clears records_received + completed, rebuilds queue).
 * Marks the completion log entry as rolled over so it persists in the forecast.
 */
export async function rolloverToNextCycle(clientId: string, filingTypeId: string) {
  const orgId = await getOrgId();
  await requireWriteAccess(orgId);

  // Mark the completion log entry as rolled over BEFORE clearing state
  const supabase = await createClient();
  await supabase
    .from('filing_completion_log')
    .update({ rolled_over_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .eq('filing_type_id', filingTypeId)
    .is('rolled_over_at', null);

  const adminClient = createAdminClient();
  const result = await rolloverFiling(adminClient, clientId, filingTypeId);

  if (!result.success) {
    return { error: result.error || 'Rollover failed' };
  }

  return { success: true };
}

/**
 * Mark a document as reviewed (sets needs_review = false).
 */
export async function markDocReviewed(docId: string) {
  const orgId = await getOrgId();
  await requireWriteAccess(orgId);

  const supabase = await createClient();

  const { error } = await supabase
    .from('client_documents')
    .update({ needs_review: false })
    .eq('id', docId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
