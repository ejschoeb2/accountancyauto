import { SupabaseClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { calculateClientStatus, calculateFilingTypeStatus, TrafficLightStatus } from './traffic-light';
import { calculateDeadline } from '@/lib/deadlines/calculators';
import type { FilingTypeStatus, FilingTypeId } from '@/lib/types/database';
import type { Client } from '@/app/actions/clients';
import { ALL_FILING_TYPE_IDS } from '@/lib/constants/filing-types';

export interface DashboardMetrics {
  overdueCount: number; // red
  criticalCount: number; // orange (< 1 week)
  approachingCount: number; // amber (1-4 weeks) - no reminder sent yet
  approachingSentCount: number; // amber (1-4 weeks) - reminder already sent
  scheduledCount: number; // blue (> 4 weeks)
  completedCount: number; // green (records received)
  violetCount: number; // violet (records received, awaiting submission)
  inactiveCount: number; // grey (paused)
  sentTodayCount: number;
  pausedCount: number;
  failedDeliveryCount: number;
  completionRate: number; // percentage of non-inactive clients that are green/violet
}

export interface ClientStatusRow {
  id: string;
  company_name: string;
  status: TrafficLightStatus;
  underlying_status?: TrafficLightStatus; // Status if reminders were not paused
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
  try {
    // Fetch all clients with their filing data
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select(`
        id,
        reminders_paused,
        records_received_for,
        completed_for,
        year_end_date,
        vat_stagger_group
      `);

    if (clientsError) {
      console.error('Error fetching clients:', clientsError);
      throw clientsError;
    }

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
  let criticalCount = 0;
  let approachingCount = 0;
  let approachingSentCount = 0;
  let scheduledCount = 0;
  let completedCount = 0;
  let violetCount = 0;
  let inactiveCount = 0;

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
      completed_for: Array.isArray(client.completed_for)
        ? client.completed_for
        : [],
      filings,
    });

    if (status === 'red') overdueCount++;
    else if (status === 'orange') criticalCount++;
    else if (status === 'amber') {
      try {
        // Check if any amber-causing filing has been sent
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const oneWeekFromNow = new Date(today);
        oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
        const fourWeeksFromNow = new Date(today);
        fourWeeksFromNow.setDate(fourWeeksFromNow.getDate() + 28);

        const recordsReceivedSet = new Set(
          Array.isArray(client.records_received_for) ? client.records_received_for : []
        );

        const hasAmberFilingSent = filings.some(filing => {
          const deadlineDate = new Date(filing.deadline_date);
          deadlineDate.setHours(0, 0, 0, 0);
          const hasRecords = recordsReceivedSet.has(filing.filing_type_id);
          const isAmberRange = deadlineDate >= oneWeekFromNow && deadlineDate < fourWeeksFromNow;
          return !hasRecords && isAmberRange && filing.has_been_sent;
        });

        if (hasAmberFilingSent) {
          approachingSentCount++;
        } else {
          approachingCount++;
        }
      } catch (amberError) {
        console.error('Error processing amber client:', client.id, amberError);
        // Default to unsent count on error
        approachingCount++;
      }
    }
    else if (status === 'blue') scheduledCount++;
    else if (status === 'green') completedCount++;
    else if (status === 'violet') violetCount++;
    else if (status === 'grey') inactiveCount++;
  }

  // Compute completion rate: (green + violet) / (total - inactive) * 100
  const totalClients = (clients || []).length;
  const activeClients = totalClients - inactiveCount;
  const completionRate = activeClients > 0
    ? ((completedCount + violetCount) / activeClients) * 100
    : 0;

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
      criticalCount,
      approachingCount,
      approachingSentCount,
      scheduledCount,
      completedCount,
      violetCount,
      inactiveCount,
      sentTodayCount: sentTodayCount || 0,
      pausedCount: pausedCount || 0,
      failedDeliveryCount: failedDeliveryCount || 0,
      completionRate,
    };
  } catch (error) {
    console.error('Error in getDashboardMetrics:', error);
    throw error;
  }
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
      completed_for,
      year_end_date,
      vat_stagger_group
    `);

  if (clientsError) throw clientsError;

  // Fetch org-level active filing types to exclude deactivated deadlines
  const { data: orgActiveTypes } = await supabase
    .from('org_filing_type_selections')
    .select('filing_type_id')
    .eq('is_active', true);
  const orgActiveSet = new Set((orgActiveTypes ?? []).map(r => r.filing_type_id));

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
    // Get client's active filings, filtered by org-level active types
    const clientAssignments = (assignments || []).filter(
      (a) => a.client_id === client.id && (orgActiveSet.size === 0 || orgActiveSet.has(a.filing_type_id))
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

    const recordsReceived = Array.isArray(client.records_received_for)
      ? client.records_received_for
      : [];
    const completedFor: string[] = Array.isArray(client.completed_for) ? client.completed_for : [];

    const aggregateStatus = calculateClientStatus({
      reminders_paused: client.reminders_paused || false,
      records_received_for: recordsReceived,
      completed_for: completedFor,
      filings,
    });

    // For paused clients, compute what status would be without the pause
    const underlying_status: TrafficLightStatus | undefined = client.reminders_paused
      ? calculateClientStatus({
          reminders_paused: false,
          records_received_for: recordsReceived,
          completed_for: completedFor,
          filings,
        })
      : undefined;

    // Find next deadline across all filings (track both date and filing type)
    const earliestFiling = filings.length > 0
      ? filings.reduce((earliest, f) => (f.deadline_date < earliest.deadline_date ? f : earliest), filings[0])
      : null;
    const next_deadline = earliestFiling?.deadline_date ?? null;
    const next_deadline_type = earliestFiling?.filing_type_id ?? null;

    // Refine status: if the aggregate says blue/scheduled but the nearest deadline
    // has records received, show violet instead (matches the "Next Deadline" column).
    let status = aggregateStatus;
    if (!client.reminders_paused && filings.length > 0) {
      // Compute per-filing statuses
      const perFilingStatuses = filings.map(f => {
        const isReceived = recordsReceived.includes(f.filing_type_id);
        const isCompleted = completedFor.includes(f.filing_type_id);
        return {
          filing_type_id: f.filing_type_id,
          status: calculateFilingTypeStatus({
            filing_type_id: f.filing_type_id,
            deadline_date: f.deadline_date,
            is_records_received: isReceived,
            is_completed: isCompleted,
            override_status: null,
          }),
          is_records_received: isReceived,
        };
      });

      // Check for urgent statuses
      const hasUrgent = perFilingStatuses.some(f =>
        f.status === 'red' || f.status === 'orange' || f.status === 'amber'
      );

      if (!hasUrgent && earliestFiling) {
        const nearestStatus = perFilingStatuses.find(
          f => f.filing_type_id === earliestFiling.filing_type_id
        );
        if (nearestStatus?.is_records_received) {
          status = 'violet';
        }
      }
    }

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
      underlying_status,
      next_deadline,
      next_deadline_type,
      days_until_deadline,
    };
  });

  // Sort by priority: RED first, then ORANGE, then AMBER, then BLUE, then GREEN, then GREY
  const statusPriority: Record<TrafficLightStatus, number> = {
    red: 1,
    orange: 2,
    amber: 3,
    blue: 4,
    violet: 5,
    green: 6,
    grey: 7,
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


/**
 * Fetch client filing statuses for the status view
 * Returns clients and a map of filing statuses per client
 */
export async function getClientFilingStatuses(
  supabase: SupabaseClient
): Promise<{
  clients: Client[];
  filingStatuses: Record<string, FilingTypeStatus[]>;
}> {
  // Fetch clients
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('*')
    .order('company_name');

  if (clientsError) throw new Error(clientsError.message);

  // Fetch status overrides for all clients
  const { data: overrides, error: overridesError } = await supabase
    .from('client_filing_status_overrides')
    .select('*');

  if (overridesError) throw new Error(overridesError.message);

  // Fetch org-level active filing types
  const { data: orgActiveFilingTypes } = await supabase
    .from('org_filing_type_selections')
    .select('filing_type_id')
    .eq('is_active', true);
  const orgActiveFilingSet = new Set((orgActiveFilingTypes ?? []).map(r => r.filing_type_id));

  // Fetch filing assignments to know which filing types are actually assigned to each client
  const { data: assignments, error: assignmentsError } = await supabase
    .from('client_filing_assignments')
    .select('client_id, filing_type_id, is_active')
    .eq('is_active', true);

  if (assignmentsError) throw new Error(assignmentsError.message);

  // Fetch mandatory document requirements per filing type (global reference data)
  const { data: reqRows } = await supabase
    .from('filing_document_requirements')
    .select('filing_type_id, document_type_id')
    .eq('is_mandatory', true);

  // Map: filing_type_id -> Set of mandatory document_type_ids
  const mandatoryDocTypes = new Map<string, Set<string>>();
  for (const row of reqRows ?? []) {
    if (!mandatoryDocTypes.has(row.filing_type_id)) {
      mandatoryDocTypes.set(row.filing_type_id, new Set());
    }
    mandatoryDocTypes.get(row.filing_type_id)!.add(row.document_type_id);
  }

  // Fetch uploaded documents per client + filing type + document type (batch)
  const { data: docRows } = await supabase
    .from('client_documents')
    .select('client_id, filing_type_id, document_type_id');

  // Track which mandatory doc types are satisfied per client+filing via uploads
  // Key: `${client_id}-${filing_type_id}`, Value: Set of satisfied document_type_ids
  const satisfiedDocTypes = new Map<string, Set<string>>();
  for (const row of docRows ?? []) {
    if (!row.filing_type_id || !row.document_type_id) continue;
    const mandatorySet = mandatoryDocTypes.get(row.filing_type_id);
    if (!mandatorySet?.has(row.document_type_id)) continue; // Only count mandatory docs
    const key = `${row.client_id}-${row.filing_type_id}`;
    if (!satisfiedDocTypes.has(key)) {
      satisfiedDocTypes.set(key, new Set());
    }
    satisfiedDocTypes.get(key)!.add(row.document_type_id);
  }

  // Fetch manually received checklist customisations (batch)
  const { data: manualRows } = await supabase
    .from('client_document_checklist_customisations')
    .select('client_id, filing_type_id, document_type_id')
    .eq('manually_received', true);

  for (const row of manualRows ?? []) {
    if (!row.filing_type_id || !row.document_type_id) continue;
    const mandatorySet = mandatoryDocTypes.get(row.filing_type_id);
    if (!mandatorySet?.has(row.document_type_id)) continue;
    const key = `${row.client_id}-${row.filing_type_id}`;
    if (!satisfiedDocTypes.has(key)) {
      satisfiedDocTypes.set(key, new Set());
    }
    satisfiedDocTypes.get(key)!.add(row.document_type_id);
  }

  // Build a map of client -> assigned filing types (filtered by org-level active)
  const clientAssignments = new Map<string, Set<string>>();
  for (const assignment of assignments || []) {
    if (orgActiveFilingSet.size > 0 && !orgActiveFilingSet.has(assignment.filing_type_id)) continue;
    if (!clientAssignments.has(assignment.client_id)) {
      clientAssignments.set(assignment.client_id, new Set());
    }
    clientAssignments.get(assignment.client_id)!.add(assignment.filing_type_id);
  }

  // Only iterate filing types that are active at org level
  const activeFilingTypes = orgActiveFilingSet.size > 0
    ? ALL_FILING_TYPE_IDS.filter(id => orgActiveFilingSet.has(id))
    : ALL_FILING_TYPE_IDS;

  // Build status map per client
  const filingStatuses: Record<string, FilingTypeStatus[]> = {};

  for (const client of clients || []) {
    const assignedFilings = clientAssignments.get(client.id) || new Set();

    const clientFilings = activeFilingTypes.map((filingTypeId) => {
      // Only process filing types that are assigned to this client OR have records received OR have manual override
      const override = overrides?.find(
        (o) => o.client_id === client.id && o.filing_type_id === filingTypeId
      );
      const isRecordsReceived = (client.records_received_for || []).includes(filingTypeId);
      const isCompleted = (client.completed_for || []).includes(filingTypeId);
      const isAssigned = assignedFilings.has(filingTypeId);

      // Skip if not assigned and no records received and no override
      if (!isAssigned && !isRecordsReceived && !override) {
        return null;
      }

      // Calculate deadline only for assigned filing types
      const deadline = isAssigned ? calculateDeadline(filingTypeId, {
        year_end_date: client.year_end_date || undefined,
        vat_stagger_group: client.vat_stagger_group || undefined,
      }) : null;
      const deadlineDate = deadline ? format(deadline, 'yyyy-MM-dd') : null;

      const status = calculateFilingTypeStatus({
        filing_type_id: filingTypeId,
        deadline_date: deadlineDate,
        is_records_received: isRecordsReceived,
        is_completed: isCompleted,
        override_status: override?.override_status || null,
      });

      return {
        filing_type_id: filingTypeId,
        status,
        is_override: !!override,
        is_records_received: isRecordsReceived,
        deadline_date: deadlineDate,
        doc_required_count: mandatoryDocTypes.get(filingTypeId)?.size ?? 0,
        doc_received_count: satisfiedDocTypes.get(`${client.id}-${filingTypeId}`)?.size ?? 0,
      };
    }).filter((filing): filing is FilingTypeStatus => filing !== null);

    filingStatuses[client.id] = clientFilings;
  }

  return { clients: clients || [], filingStatuses };
}
