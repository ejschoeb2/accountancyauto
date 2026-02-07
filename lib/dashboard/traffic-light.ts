/**
 * Traffic-light status calculation for client reminder tracking
 *
 * Status priority (first match wins):
 * - GREY: Paused or no active filings
 * - RED: Any deadline passed without records
 * - AMBER: Actively chasing (reminder sent, no records, deadline not passed)
 * - GREEN: All filings on track
 */

export type TrafficLightStatus = 'green' | 'amber' | 'red' | 'grey';

export interface ClientStatusInput {
  reminders_paused: boolean;
  records_received_for: string[]; // array of filing_type_id strings
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
 * RED: ANY filing where deadline_date < today AND filing_type_id NOT in records_received_for
 * AMBER: ANY filing where has_been_sent = true AND filing_type_id NOT in records_received_for AND deadline NOT passed
 * GREEN: All filings either have records received OR no reminders sent yet and deadline not passed
 *
 * Priority order: grey > red > amber > green (check in this order, first match wins)
 */
export function calculateClientStatus(input: ClientStatusInput): TrafficLightStatus {
  const { reminders_paused, records_received_for, filings } = input;

  // GREY: Paused or no active filings
  if (reminders_paused || filings.length === 0) {
    return 'grey';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0); // normalize to start of day for comparison

  const recordsReceivedSet = new Set(records_received_for);

  // RED: Any deadline passed without records
  for (const filing of filings) {
    const deadlineDate = new Date(filing.deadline_date);
    deadlineDate.setHours(0, 0, 0, 0);

    const hasRecords = recordsReceivedSet.has(filing.filing_type_id);
    const deadlinePassed = deadlineDate < today;

    if (deadlinePassed && !hasRecords) {
      return 'red';
    }
  }

  // AMBER: Actively chasing (reminder sent, no records, deadline not passed)
  for (const filing of filings) {
    const deadlineDate = new Date(filing.deadline_date);
    deadlineDate.setHours(0, 0, 0, 0);

    const hasRecords = recordsReceivedSet.has(filing.filing_type_id);
    const deadlinePassed = deadlineDate < today;

    if (filing.has_been_sent && !hasRecords && !deadlinePassed) {
      return 'amber';
    }
  }

  // GREEN: All filings on track
  return 'green';
}
