import { SupabaseClient } from '@supabase/supabase-js';
import { addYears, format } from 'date-fns';
import { UTCDate } from '@date-fns/utc';
import { rebuildQueueForClient } from '@/lib/reminders/queue-builder';

/**
 * Annual filing types that require year_end_date advancement
 */
const ANNUAL_FILING_TYPES = [
  'corporation_tax_payment',
  'ct600_filing',
  'companies_house',
] as const;

/**
 * Check if a filing type is annual (requires year-end advancement)
 */
function isAnnualFiling(filingTypeId: string): boolean {
  return ANNUAL_FILING_TYPES.includes(filingTypeId as any);
}

export interface RolloverResult {
  success: boolean;
  client_id: string;
  filing_type_id: string;
  old_year_end?: string;
  new_year_end?: string;
  error?: string;
}

/**
 * Roll over a single filing type for a client to the next cycle
 *
 * Steps:
 * 1. Advance year_end_date if annual filing (Corp Tax, CT600, Companies House)
 * 2. Remove filing type from records_received_for and completed_for arrays
 * 3. Delete scheduled reminders for this filing type
 * 4. Rebuild queue (will calculate new deadlines)
 * 5. Log to audit trail
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
      .select('id, company_name, year_end_date, records_received_for, completed_for')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      throw new Error(`Failed to fetch client: ${clientError?.message}`);
    }

    let oldYearEnd: string | undefined;
    let newYearEnd: string | undefined;

    // 2. Advance year_end_date if this is an annual filing
    if (isAnnualFiling(filingTypeId)) {
      if (!client.year_end_date) {
        throw new Error(`Client ${clientId} has no year_end_date for annual filing rollover`);
      }

      oldYearEnd = client.year_end_date;
      const yearEndDate = new UTCDate(client.year_end_date);
      const nextYearEnd = addYears(yearEndDate, 1);
      newYearEnd = format(nextYearEnd, 'yyyy-MM-dd');

      const { error: updateError } = await supabase
        .from('clients')
        .update({ year_end_date: newYearEnd })
        .eq('id', clientId);

      if (updateError) {
        throw new Error(`Failed to update year_end_date: ${updateError.message}`);
      }
    }

    // 3. Remove filing type from records_received_for and completed_for arrays
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

    // 4. Delete scheduled reminders for this filing type
    const { error: deleteError } = await supabase
      .from('reminder_queue')
      .delete()
      .eq('client_id', clientId)
      .eq('filing_type_id', filingTypeId)
      .eq('status', 'scheduled');

    if (deleteError) {
      throw new Error(`Failed to delete scheduled reminders: ${deleteError.message}`);
    }

    // 5. Rebuild queue for this client (will create reminders for next cycle)
    await rebuildQueueForClient(supabase, clientId);

    // 6. Log to audit trail
    await supabase.from('audit_log').insert({
      action: 'rollover_filing',
      client_id: clientId,
      filing_type_id: filingTypeId,
      metadata: {
        old_year_end: oldYearEnd,
        new_year_end: newYearEnd,
        is_annual: isAnnualFiling(filingTypeId),
      },
    });

    return {
      success: true,
      client_id: clientId,
      filing_type_id: filingTypeId,
      old_year_end: oldYearEnd,
      new_year_end: newYearEnd,
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
