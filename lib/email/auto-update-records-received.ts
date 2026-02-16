import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Auto-update client status when documents are detected via inbound email
 *
 * This function:
 * 1. Validates client has the filing type assigned
 * 2. Updates client.records_received_for to include the filing type
 * 3. Updates reminder_queue status to 'records_received' for all scheduled reminders
 *
 * Used by /api/postmark/inbound webhook when keyword detector finds documents.
 */
export async function autoUpdateRecordsReceived(
  clientId: string,
  filingTypeId: string,
  supabase: SupabaseClient
): Promise<{ success: boolean; message: string }> {
  try {
    // Step 1: Validate client has this filing type assigned
    const { data: assignment, error: assignmentError } = await supabase
      .from('client_filing_assignments')
      .select('id, is_active')
      .eq('client_id', clientId)
      .eq('filing_type_id', filingTypeId)
      .maybeSingle();

    if (assignmentError) {
      console.error('[Auto-update] Error checking filing assignment:', assignmentError);
      return {
        success: false,
        message: `Failed to verify filing assignment: ${assignmentError.message}`,
      };
    }

    if (!assignment) {
      console.warn('[Auto-update] Client does not have filing type assigned:', {
        clientId,
        filingTypeId,
      });
      return {
        success: false,
        message: 'Client does not have this filing type assigned',
      };
    }

    if (!assignment.is_active) {
      console.warn('[Auto-update] Filing assignment is inactive:', {
        clientId,
        filingTypeId,
      });
      return {
        success: false,
        message: 'Filing type assignment is inactive',
      };
    }

    // Step 2: Fetch current client records_received_for
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('records_received_for')
      .eq('id', clientId)
      .single();

    if (clientError) {
      console.error('[Auto-update] Error fetching client:', clientError);
      return {
        success: false,
        message: `Failed to fetch client: ${clientError.message}`,
      };
    }

    const currentRecordsReceived = client.records_received_for || [];

    // Check if already marked as received (idempotent)
    if (currentRecordsReceived.includes(filingTypeId)) {
      console.log('[Auto-update] Already marked as received:', {
        clientId,
        filingTypeId,
      });
      return {
        success: true,
        message: 'Already marked as records received',
      };
    }

    // Step 3: Update client.records_received_for
    const newRecordsReceived = [...currentRecordsReceived, filingTypeId];

    const { error: updateClientError } = await supabase
      .from('clients')
      .update({
        records_received_for: newRecordsReceived,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId);

    if (updateClientError) {
      console.error('[Auto-update] Error updating client:', updateClientError);
      return {
        success: false,
        message: `Failed to update client: ${updateClientError.message}`,
      };
    }

    // Step 4: Cancel scheduled reminders by setting status to 'records_received'
    const { data: cancelledReminders, error: cancelError } = await supabase
      .from('reminder_queue')
      .update({ status: 'records_received' })
      .eq('client_id', clientId)
      .eq('filing_type_id', filingTypeId)
      .eq('status', 'scheduled')
      .select();

    if (cancelError) {
      console.error('[Auto-update] Error cancelling reminders:', cancelError);
      // Don't fail the whole operation - client status is updated
      return {
        success: true,
        message: 'Client updated but failed to cancel reminders',
      };
    }

    const cancelledCount = cancelledReminders?.length || 0;

    console.log('[Auto-update] Successfully updated records_received:', {
      clientId,
      filingTypeId,
      cancelledReminders: cancelledCount,
    });

    return {
      success: true,
      message: `Marked as received and cancelled ${cancelledCount} scheduled reminders`,
    };
  } catch (error) {
    console.error('[Auto-update] Unexpected error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
