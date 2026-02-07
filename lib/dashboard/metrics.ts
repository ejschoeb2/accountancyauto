import { SupabaseClient } from '@supabase/supabase-js';
import { calculateClientStatus, TrafficLightStatus } from './traffic-light';

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
      records_received_for
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

  // Fetch reminder queue to determine deadlines and sent status
  const { data: reminders, error: remindersError } = await supabase
    .from('reminder_queue')
    .select(`
      client_id,
      filing_type_id,
      deadline_date,
      status
    `)
    .in('status', ['scheduled', 'pending', 'sent']);

  if (remindersError) throw remindersError;

  // Calculate traffic-light status for each client
  let overdueCount = 0;
  let chasingCount = 0;

  for (const client of clients || []) {
    // Get client's active filings
    const clientAssignments = (assignments || []).filter(
      (a) => a.client_id === client.id
    );

    // Build filings array for this client
    const filings = clientAssignments.map((assignment) => {
      // Find reminders for this filing type
      const clientReminders = (reminders || []).filter(
        (r) => r.client_id === client.id && r.filing_type_id === assignment.filing_type_id
      );

      // Get earliest deadline
      const earliestDeadline = clientReminders.length > 0
        ? clientReminders.reduce((earliest, r) => {
            return !earliest || r.deadline_date < earliest
              ? r.deadline_date
              : earliest;
          }, clientReminders[0].deadline_date)
        : null;

      // Check if any reminder has been sent
      const has_been_sent = clientReminders.some((r) => r.status === 'sent');

      return {
        filing_type_id: assignment.filing_type_id,
        deadline_date: earliestDeadline || '9999-12-31', // far future if no deadline
        has_been_sent,
      };
    });

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
      records_received_for
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

  // Fetch reminder queue to determine deadlines and sent status
  const { data: reminders, error: remindersError } = await supabase
    .from('reminder_queue')
    .select(`
      client_id,
      filing_type_id,
      deadline_date,
      status
    `)
    .in('status', ['scheduled', 'pending', 'sent']);

  if (remindersError) throw remindersError;

  // Build client status rows
  const statusRows: ClientStatusRow[] = (clients || []).map((client) => {
    // Get client's active filings
    const clientAssignments = (assignments || []).filter(
      (a) => a.client_id === client.id
    );

    // Build filings array for this client
    const filings = clientAssignments.map((assignment) => {
      // Find reminders for this filing type
      const clientReminders = (reminders || []).filter(
        (r) => r.client_id === client.id && r.filing_type_id === assignment.filing_type_id
      );

      // Get earliest deadline
      const earliestDeadline = clientReminders.length > 0
        ? clientReminders.reduce((earliest, r) => {
            return !earliest || r.deadline_date < earliest
              ? r.deadline_date
              : earliest;
          }, clientReminders[0].deadline_date)
        : null;

      // Check if any reminder has been sent
      const has_been_sent = clientReminders.some((r) => r.status === 'sent');

      return {
        filing_type_id: assignment.filing_type_id,
        deadline_date: earliestDeadline || '9999-12-31', // far future if no deadline
        has_been_sent,
      };
    });

    const status = calculateClientStatus({
      reminders_paused: client.reminders_paused || false,
      records_received_for: Array.isArray(client.records_received_for)
        ? client.records_received_for
        : [],
      filings,
    });

    // Find next deadline across all filings
    const deadlines = filings
      .filter((f) => f.deadline_date !== '9999-12-31')
      .map((f) => f.deadline_date);

    const next_deadline = deadlines.length > 0
      ? deadlines.reduce((earliest, d) => (d < earliest ? d : earliest))
      : null;

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
