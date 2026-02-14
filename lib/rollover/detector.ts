import { SupabaseClient } from '@supabase/supabase-js';
import { calculateDeadline } from '@/lib/deadlines/calculators';
import { format, differenceInDays } from 'date-fns';
import { UTCDate } from '@date-fns/utc';

export interface RolloverCandidate {
  client_id: string;
  client_name: string;
  filing_type_id: string;
  deadline_date: string;
  days_overdue: number;
}

/**
 * Find all client+filing combinations ready to roll over
 *
 * Criteria:
 * 1. Filing type is in client's records_received_for array
 * 2. Deadline has passed
 * 3. Client has active filing assignment for this type
 */
export async function getRolloverCandidates(
  supabase: SupabaseClient
): Promise<RolloverCandidate[]> {
  const today = new UTCDate();
  const candidates: RolloverCandidate[] = [];

  // Fetch all clients with their metadata
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select(`
      id,
      company_name,
      year_end_date,
      vat_stagger_group,
      records_received_for,
      reminders_paused
    `);

  if (clientsError) {
    throw new Error(`Failed to fetch clients: ${clientsError.message}`);
  }

  if (!clients || clients.length === 0) {
    return [];
  }

  // Fetch all active filing assignments
  const { data: assignments, error: assignmentsError } = await supabase
    .from('client_filing_assignments')
    .select('client_id, filing_type_id')
    .eq('is_active', true);

  if (assignmentsError) {
    throw new Error(`Failed to fetch assignments: ${assignmentsError.message}`);
  }

  // Process each client
  for (const client of clients) {
    // Skip paused clients
    if (client.reminders_paused) continue;

    // Skip if no records received
    if (!client.records_received_for || client.records_received_for.length === 0) {
      continue;
    }

    // Get this client's active filing assignments
    const clientAssignments = (assignments || []).filter(
      (a) => a.client_id === client.id
    );

    // Check each filing type that has records received
    for (const filingTypeId of client.records_received_for) {
      // Verify client has active assignment for this filing type
      const hasAssignment = clientAssignments.some(
        (a) => a.filing_type_id === filingTypeId
      );

      if (!hasAssignment) continue;

      // Calculate deadline for this filing type
      const deadline = calculateDeadline(filingTypeId, {
        year_end_date: client.year_end_date || undefined,
        vat_stagger_group: client.vat_stagger_group || undefined,
      });

      if (!deadline) continue;

      // Check if deadline has passed
      if (deadline < today) {
        const daysOverdue = differenceInDays(today, deadline);

        candidates.push({
          client_id: client.id,
          client_name: client.company_name,
          filing_type_id: filingTypeId,
          deadline_date: format(deadline, 'yyyy-MM-dd'),
          days_overdue: daysOverdue,
        });
      }
    }
  }

  // Sort by days overdue (most overdue first)
  return candidates.sort((a, b) => b.days_overdue - a.days_overdue);
}

/**
 * Get count of rollover candidates grouped by filing type
 */
export async function getRolloverSummary(
  supabase: SupabaseClient
): Promise<Record<string, number>> {
  const candidates = await getRolloverCandidates(supabase);

  const summary: Record<string, number> = {};

  for (const candidate of candidates) {
    summary[candidate.filing_type_id] = (summary[candidate.filing_type_id] || 0) + 1;
  }

  return summary;
}
