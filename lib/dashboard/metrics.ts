import { SupabaseClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { calculateClientStatus, TrafficLightStatus } from './traffic-light';
import { calculateDeadline } from '@/lib/deadlines/calculators';

export interface DashboardMetrics {
  overdueCount: number;
  chasingCount: number;
  sentTodayCount: number;
  pausedCount: number;
  failedDeliveryCount: number;
}

export interface ClientStatusRow {
  id: string;
  company_name: string;
  status: TrafficLightStatus;
  next_deadline: string | null;
  next_deadline_type: string | null;
  days_until_deadline: number | null;
}

/**
 * Fetch dashboard summary metrics
 */
export async function getDashboardMetrics(
  supabase: SupabaseClient
): Promise<DashboardMetrics> {
  // Fetch all clients with their filing data
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select(`
      id,
      reminders_paused,
      records_received_for,
      year_end_date,
      vat_stagger_group
    `);

  if (clientsError) throw clientsError;

  // Fetch all active filing assignments
  const { data: assignments, error: assignmentsError } = await supabase
    .from('client_filing_assignments')
    .select(`
      client_id,
      filing_type_id,
      is_active
    `)
    .eq('is_active', true);

  if (assignmentsError) throw assignmentsError;

  // Fetch reminder queue to determine sent status only
  const { data: reminders, error: remindersError } = await supabase
    .from('reminder_queue')
    .select(`
      client_id,
      filing_type_id,
      status
    `)
    .eq('status', 'sent');

  if (remindersError) throw remindersError;

  // Build sent-status lookup: "clientId_filingTypeId" -> true
  const sentSet = new Set(
    (reminders || []).map((r) => `${r.client_id}_${r.filing_type_id}`)
  );

  // Calculate traffic-light status for each client
  let overdueCount = 0;
  let chasingCount = 0;

  for (const client of clients || []) {
    // Get client's active filings
    const clientAssignments = (assignments || []).filter(
      (a) => a.client_id === client.id
    );

    // Build filings array using deadline calculators
    const filings = clientAssignments
      .map((assignment) => {
        const deadline = calculateDeadline(assignment.filing_type_id, {
          year_end_date: client.year_end_date || undefined,
          vat_stagger_group: client.vat_stagger_group || undefined,
        });

        if (!deadline) return null;

        return {
          filing_type_id: assignment.filing_type_id,
          deadline_date: format(deadline, 'yyyy-MM-dd'),
          has_been_sent: sentSet.has(`${client.id}_${assignment.filing_type_id}`),
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    const status = calculateClientStatus({
      reminders_paused: client.reminders_paused || false,
      records_received_for: Array.isArray(client.records_received_for)
        ? client.records_received_for
        : [],
      filings,
    });

    if (status === 'red') overdueCount++;
    if (status === 'amber') chasingCount++;
  }

  // Query email_log for today's sent count
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { count: sentTodayCount, error: sentTodayError } = await supabase
    .from('email_log')
    .select('*', { count: 'exact', head: true })
    .gte('sent_at', todayStart.toISOString())
    .lte('sent_at', todayEnd.toISOString());

  if (sentTodayError) throw sentTodayError;

  // Query clients for paused count
  const { count: pausedCount, error: pausedError } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('reminders_paused', true);

  if (pausedError) throw pausedError;

  // Query email_log for failed delivery count
  const { count: failedDeliveryCount, error: failedError } = await supabase
    .from('email_log')
    .select('*', { count: 'exact', head: true })
    .in('delivery_status', ['bounced', 'failed']);

  if (failedError) throw failedError;

  return {
    overdueCount,
    chasingCount,
    sentTodayCount: sentTodayCount || 0,
    pausedCount: pausedCount || 0,
    failedDeliveryCount: failedDeliveryCount || 0,
  };
}

/**
 * Fetch client status list sorted by traffic-light priority
 */
export async function getClientStatusList(
  supabase: SupabaseClient
): Promise<ClientStatusRow[]> {
  // Fetch all clients with their filing data
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select(`
      id,
      company_name,
      reminders_paused,
      records_received_for,
      year_end_date,
      vat_stagger_group
    `);

  if (clientsError) throw clientsError;

  // Fetch all active filing assignments
  const { data: assignments, error: assignmentsError } = await supabase
    .from('client_filing_assignments')
    .select(`
      client_id,
      filing_type_id,
      is_active
    `)
    .eq('is_active', true);

  if (assignmentsError) throw assignmentsError;

  // Fetch reminder queue to determine sent status only
  const { data: reminders, error: remindersError } = await supabase
    .from('reminder_queue')
    .select(`
      client_id,
      filing_type_id,
      status
    `)
    .eq('status', 'sent');

  if (remindersError) throw remindersError;

  // Build sent-status lookup: "clientId_filingTypeId" -> true
  const sentSet = new Set(
    (reminders || []).map((r) => `${r.client_id}_${r.filing_type_id}`)
  );

  // Build client status rows
  const statusRows: ClientStatusRow[] = (clients || []).map((client) => {
    // Get client's active filings
    const clientAssignments = (assignments || []).filter(
      (a) => a.client_id === client.id
    );

    // Build filings array using deadline calculators
    const filings = clientAssignments
      .map((assignment) => {
        const deadline = calculateDeadline(assignment.filing_type_id, {
          year_end_date: client.year_end_date || undefined,
          vat_stagger_group: client.vat_stagger_group || undefined,
        });

        if (!deadline) return null;

        return {
          filing_type_id: assignment.filing_type_id,
          deadline_date: format(deadline, 'yyyy-MM-dd'),
          has_been_sent: sentSet.has(`${client.id}_${assignment.filing_type_id}`),
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    const status = calculateClientStatus({
      reminders_paused: client.reminders_paused || false,
      records_received_for: Array.isArray(client.records_received_for)
        ? client.records_received_for
        : [],
      filings,
    });

    // Find next deadline across all filings (track both date and filing type)
    const earliestFiling = filings.length > 0
      ? filings.reduce((earliest, f) => (f.deadline_date < earliest.deadline_date ? f : earliest), filings[0])
      : null;
    const next_deadline = earliestFiling?.deadline_date ?? null;
    const next_deadline_type = earliestFiling?.filing_type_id ?? null;

    // Calculate days until deadline
    let days_until_deadline: number | null = null;
    if (next_deadline) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deadline = new Date(next_deadline);
      deadline.setHours(0, 0, 0, 0);
      days_until_deadline = Math.ceil(
        (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    return {
      id: client.id,
      company_name: client.company_name,
      status,
      next_deadline,
      next_deadline_type,
      days_until_deadline,
    };
  });

  // Sort by priority: RED first, then AMBER, then GREEN, then GREY
  const statusPriority: Record<TrafficLightStatus, number> = {
    red: 1,
    amber: 2,
    green: 3,
    grey: 4,
  };

  return statusRows.sort((a, b) => {
    const priorityDiff = statusPriority[a.status] - statusPriority[b.status];
    if (priorityDiff !== 0) return priorityDiff;

    // Within same status, sort by next deadline (earliest first)
    if (a.next_deadline && b.next_deadline) {
      return a.next_deadline.localeCompare(b.next_deadline);
    }
    if (a.next_deadline) return -1;
    if (b.next_deadline) return 1;

    return 0;
  });
}
