import { SupabaseClient } from '@supabase/supabase-js';
import { rebuildQueueForClient } from '@/lib/reminders/queue-builder';

export interface RolloverResult {
  success: boolean;
  client_id: string;
  filing_type_id: string;
  error?: string;
}

/**
 * Roll over a single filing type for a client to the next cycle
 *
 * Steps:
 * 1. Remove filing type from records_received_for and completed_for arrays
 * 2. Delete scheduled reminders for this filing type
 * 3. Rebuild queue (calculateDeadline will find next upcoming deadline)
 * 4. Log to audit trail
 *
 * Note: year_end_date is NOT advanced. Each filing type independently finds
 * its next upcoming deadline via calculateDeadline's loop-forward logic.
 * This prevents one filing's rollover from skipping another's deadline.
 */
export async function rolloverFiling(
  supabase: SupabaseClient,
  clientId: string,
  filingTypeId: string
): Promise<RolloverResult> {
  try {
    // 1. Fetch client data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, company_name, records_received_for, completed_for')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      throw new Error(`Failed to fetch client: ${clientError?.message}`);
    }

    // 2. Remove filing type from records_received_for and completed_for arrays
    const currentRecordsReceived = Array.isArray(client.records_received_for)
      ? client.records_received_for
      : [];
    const currentCompletedFor = Array.isArray(client.completed_for)
      ? client.completed_for
      : [];

    const updatedRecordsReceived = currentRecordsReceived.filter(
      (id) => id !== filingTypeId
    );
    const updatedCompletedFor = currentCompletedFor.filter(
      (id) => id !== filingTypeId
    );

    const { error: recordsError } = await supabase
      .from('clients')
      .update({
        records_received_for: updatedRecordsReceived,
        completed_for: updatedCompletedFor,
      })
      .eq('id', clientId);

    if (recordsError) {
      throw new Error(`Failed to update records_received_for and completed_for: ${recordsError.message}`);
    }

    // 3. Delete scheduled reminders for this filing type
    const { error: deleteError } = await supabase
      .from('reminder_queue')
      .delete()
      .eq('client_id', clientId)
      .eq('filing_type_id', filingTypeId)
      .eq('status', 'scheduled');

    if (deleteError) {
      throw new Error(`Failed to delete scheduled reminders: ${deleteError.message}`);
    }

    // 4. Rebuild queue for this client (will create reminders for next cycle)
    await rebuildQueueForClient(supabase, clientId);

    // 5. Log to audit trail
    await supabase.from('audit_log').insert({
      action: 'rollover_filing',
      client_id: clientId,
      filing_type_id: filingTypeId,
    });

    return {
      success: true,
      client_id: clientId,
      filing_type_id: filingTypeId,
    };
  } catch (error) {
    return {
      success: false,
      client_id: clientId,
      filing_type_id: filingTypeId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Roll over multiple filings in bulk
 */
export async function bulkRollover(
  supabase: SupabaseClient,
  items: Array<{ client_id: string; filing_type_id: string }>
): Promise<{ results: RolloverResult[]; successCount: number; errorCount: number }> {
  const results: RolloverResult[] = [];

  for (const item of items) {
    const result = await rolloverFiling(supabase, item.client_id, item.filing_type_id);
    results.push(result);
  }

  const successCount = results.filter((r) => r.success).length;
  const errorCount = results.filter((r) => !r.success).length;

  return { results, successCount, errorCount };
}
