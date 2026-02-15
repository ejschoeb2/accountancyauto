/**
 * Traffic-light status calculation for client reminder tracking
 *
 * Status priority (first match wins):
 * - GREY: Paused or no active filings
 * - GREEN: Accountant completed processing (records received + accountant marked complete)
 * - VIOLET: Records received from client (but not yet completed by accountant)
 * - RED: Deadline passed without records (Overdue)
 * - ORANGE: < 1 week until deadline (Critical)
 * - AMBER: 1-4 weeks until deadline (Approaching)
 * - BLUE: > 4 weeks until deadline (Scheduled)
 */

export type TrafficLightStatus = 'green' | 'violet' | 'blue' | 'amber' | 'orange' | 'red' | 'grey';

export interface ClientStatusInput {
  reminders_paused: boolean;
  records_received_for: string[]; // array of filing_type_id strings
  completed_for: string[]; // array of filing_type_id strings (accountant marked complete)
  filings: Array<{
    filing_type_id: string;
    deadline_date: string; // ISO date
    has_been_sent: boolean; // whether any reminder has been sent for this filing
  }>;
}

/**
 * Calculate traffic-light status for a single client
 *
 * GREY: Client has reminders_paused = true OR filings array is empty
 * GREEN: ALL filings have records received AND accountant marked complete
 * VIOLET: ALL filings have records received (but not all marked complete by accountant)
 * RED: ANY filing where deadline_date < today AND filing_type_id NOT in records_received_for (Overdue)
 * ORANGE: ANY filing where deadline is < 1 week away AND no records (Critical)
 * AMBER: ANY filing where deadline is 1-4 weeks away AND no records (Approaching)
 * BLUE: All remaining filings > 4 weeks away (Scheduled)
 *
 * Priority order: grey > green > violet > red > orange > amber > blue (check in this order, first match wins)
 */
export function calculateClientStatus(input: ClientStatusInput): TrafficLightStatus {
  const { reminders_paused, records_received_for, completed_for, filings } = input;

  // GREY: Paused or no active filings
  if (reminders_paused || filings.length === 0) {
    return 'grey';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0); // normalize to start of day for comparison

  const recordsReceivedSet = new Set(records_received_for);
  const completedSet = new Set(completed_for);

  // Check if ALL filings have records received
  const allRecordsReceived = filings.every(filing =>
    recordsReceivedSet.has(filing.filing_type_id)
  );

  // Check if ALL filings are completed (both records received AND accountant marked complete)
  const allCompleted = filings.every(filing =>
    recordsReceivedSet.has(filing.filing_type_id) && completedSet.has(filing.filing_type_id)
  );

  if (allCompleted) {
    return 'green'; // GREEN: All filings fully completed
  }

  if (allRecordsReceived) {
    return 'violet'; // VIOLET: All records received but not all completed by accountant
  }

  // Time thresholds
  const oneWeekFromNow = new Date(today);
  oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);

  const fourWeeksFromNow = new Date(today);
  fourWeeksFromNow.setDate(fourWeeksFromNow.getDate() + 28);

  // RED: Any deadline passed without records
  for (const filing of filings) {
    const deadlineDate = new Date(filing.deadline_date);
    deadlineDate.setHours(0, 0, 0, 0);

    const hasRecords = recordsReceivedSet.has(filing.filing_type_id);
    const deadlinePassed = deadlineDate < today;

    if (deadlinePassed && !hasRecords) {
      return 'red'; // Overdue
    }
  }

  // ORANGE: Any deadline < 1 week away without records
  for (const filing of filings) {
    const deadlineDate = new Date(filing.deadline_date);
    deadlineDate.setHours(0, 0, 0, 0);

    const hasRecords = recordsReceivedSet.has(filing.filing_type_id);

    if (!hasRecords && deadlineDate >= today && deadlineDate < oneWeekFromNow) {
      return 'orange'; // Critical (< 1 week)
    }
  }

  // AMBER: Any deadline 1-4 weeks away without records
  for (const filing of filings) {
    const deadlineDate = new Date(filing.deadline_date);
    deadlineDate.setHours(0, 0, 0, 0);

    const hasRecords = recordsReceivedSet.has(filing.filing_type_id);

    if (!hasRecords && deadlineDate >= oneWeekFromNow && deadlineDate < fourWeeksFromNow) {
      return 'amber'; // Approaching (1-4 weeks)
    }
  }

  // BLUE: All remaining filings > 4 weeks away
  return 'blue'; // Scheduled (> 4 weeks)
}

/**
 * Calculate status for a single filing type
 *
 * Priority:
 * 1. If completed (records received + accountant marked complete), show green
 * 2. If only records received (not yet completed), show violet
 * 3. If manual override exists, use it
 * 4. Calculate based on deadline:
 *    - RED: Overdue (deadline passed)
 *    - ORANGE: Critical (< 1 week)
 *    - AMBER: Approaching (1-4 weeks)
 *    - BLUE: Scheduled (> 4 weeks)
 *    - GREY: No deadline set
 */
export interface FilingStatusInput {
  filing_type_id: string;
  deadline_date: string | null;
  is_records_received: boolean;
  is_completed: boolean; // accountant marked as complete
  override_status: TrafficLightStatus | null;
}

export function calculateFilingTypeStatus(input: FilingStatusInput): TrafficLightStatus {
  // Priority 1: If completed (both records received AND accountant marked complete), show green
  if (input.is_records_received && input.is_completed) {
    return 'green';
  }

  // Priority 2: If only records received (not yet completed by accountant), show violet
  if (input.is_records_received) {
    return 'violet';
  }

  // Priority 2: If manual override exists, use it
  if (input.override_status) {
    return input.override_status;
  }

  // Priority 3: Calculate based on deadline
  if (!input.deadline_date) {
    return 'grey'; // No deadline set
  }

  const deadline = new Date(input.deadline_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Time thresholds
  const oneWeekFromNow = new Date(today);
  oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);

  const fourWeeksFromNow = new Date(today);
  fourWeeksFromNow.setDate(fourWeeksFromNow.getDate() + 28);

  if (deadline < today) {
    return 'red'; // Overdue
  } else if (deadline < oneWeekFromNow) {
    return 'orange'; // Critical (< 1 week)
  } else if (deadline < fourWeeksFromNow) {
    return 'amber'; // Approaching (1-4 weeks)
  } else {
    return 'blue'; // Scheduled (> 4 weeks)
  }
}
