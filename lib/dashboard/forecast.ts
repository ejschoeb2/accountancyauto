import { SupabaseClient } from '@supabase/supabase-js';
import { format, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import {
  calculateCorporationTaxPayment,
  calculateCT600Filing,
  calculateCompaniesHouseAccounts,
  calculateVATDeadline,
  calculateSelfAssessmentDeadline,
  getStaggerQuarterEnds,
  type VatStaggerGroup,
} from '@/lib/deadlines/calculators';

export interface MonthlyWorkload {
  month: string; // e.g. "Mar 2026"
  isoMonth: string; // e.g. "2026-03"
  count: number;
}

/**
 * Calculate a 6-month workload forecast by bucketing upcoming deadlines into months.
 */
export async function getWorkloadForecast(
  supabase: SupabaseClient,
  monthsAhead = 6
): Promise<MonthlyWorkload[]> {
  // Fetch active clients with relevant metadata
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, year_end_date, vat_stagger_group, reminders_paused')
    .eq('reminders_paused', false);

  if (clientsError) throw clientsError;

  // Fetch active filing assignments
  const { data: assignments, error: assignmentsError } = await supabase
    .from('client_filing_assignments')
    .select('client_id, filing_type_id')
    .eq('is_active', true);

  if (assignmentsError) throw assignmentsError;

  // Build month buckets
  const now = new Date();
  const rangeStart = startOfMonth(now);
  const rangeEnd = endOfMonth(addMonths(now, monthsAhead - 1));

  const buckets = new Map<string, number>();
  for (let i = 0; i < monthsAhead; i++) {
    const m = addMonths(rangeStart, i);
    buckets.set(format(m, 'yyyy-MM'), 0);
  }

  const isInRange = (d: Date) => d >= rangeStart && d <= rangeEnd;
  const bucketKey = (d: Date) => format(d, 'yyyy-MM');

  // Group assignments by client
  const clientAssignmentMap = new Map<string, string[]>();
  for (const a of assignments || []) {
    const list = clientAssignmentMap.get(a.client_id) || [];
    list.push(a.filing_type_id);
    clientAssignmentMap.set(a.client_id, list);
  }

  const currentYear = now.getFullYear();
  const nextYear = currentYear + 1;

  for (const client of clients || []) {
    const filingTypes = clientAssignmentMap.get(client.id) || [];
    const yearEnd = client.year_end_date ? new Date(client.year_end_date) : null;

    for (const filingType of filingTypes) {
      const deadlines: Date[] = [];

      switch (filingType) {
        case 'corporation_tax_payment':
          if (yearEnd) deadlines.push(calculateCorporationTaxPayment(yearEnd));
          break;
        case 'ct600_filing':
          if (yearEnd) deadlines.push(calculateCT600Filing(yearEnd));
          break;
        case 'companies_house':
          if (yearEnd) deadlines.push(calculateCompaniesHouseAccounts(yearEnd));
          break;
        case 'vat_return': {
          const sg = client.vat_stagger_group as VatStaggerGroup | null;
          if (sg) {
            // Enumerate quarter ends for current + next year, compute deadlines
            const quarterEnds = [
              ...getStaggerQuarterEnds(sg, currentYear),
              ...getStaggerQuarterEnds(sg, nextYear),
            ];
            for (const qe of quarterEnds) {
              deadlines.push(calculateVATDeadline(qe));
            }
          }
          break;
        }
        case 'self_assessment':
          deadlines.push(calculateSelfAssessmentDeadline(currentYear));
          deadlines.push(calculateSelfAssessmentDeadline(nextYear));
          break;
      }

      // Bucket each deadline that falls in range
      for (const d of deadlines) {
        if (isInRange(d)) {
          const key = bucketKey(d);
          if (buckets.has(key)) {
            buckets.set(key, buckets.get(key)! + 1);
          }
        }
      }
    }
  }

  // Convert to output array
  const result: MonthlyWorkload[] = [];
  for (let i = 0; i < monthsAhead; i++) {
    const m = addMonths(rangeStart, i);
    const iso = format(m, 'yyyy-MM');
    result.push({
      month: format(m, 'MMM yyyy'),
      isoMonth: iso,
      count: buckets.get(iso) || 0,
    });
  }

  return result;
}
