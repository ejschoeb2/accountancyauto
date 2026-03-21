import { SupabaseClient } from '@supabase/supabase-js';
import {
  format,
  addMonths,
  addDays,
  addYears,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
} from 'date-fns';
import { UTCDate } from '@date-fns/utc';
import { calculateFilingTypeStatus, type TrafficLightStatus } from './traffic-light';
import {
  calculateCorporationTaxPayment,
  calculateCT600Filing,
  calculateCompaniesHouseAccounts,
  calculateVATDeadline,
  calculateSelfAssessmentDeadline,
  getStaggerQuarterEnds,
  getNextMTDQuarterDeadline,
  calculateConfirmationStatementDeadline,
  calculateP11DDeadline,
  calculatePayrollYearEndDeadline,
  calculateSAPaymentOnAccount,
  type VatStaggerGroup,
} from '@/lib/deadlines/calculators';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ForecastTimeframe = 'this-week' | '4-weeks' | '6-months' | '12-months';

export interface BucketStatusBreakdown {
  red: number;
  orange: number;
  amber: number;
  blue: number;
  violet: number;
  green: number;
}

export interface ForecastBucket {
  label: string;
  isoKey: string;
  isCurrent: boolean;
  breakdown: BucketStatusBreakdown;
  total: number;
}

// Keep old type for backwards compat (used by other pages if any)
export interface MonthlyWorkload {
  month: string;
  isoMonth: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Helpers – enumerate all deadlines of a filing type within a date range
// ---------------------------------------------------------------------------

function allDeadlinesInRange(
  filingTypeId: string,
  client: { year_end_date: string | null; vat_stagger_group: number | null; incorporation_date?: string | null },
  rangeStart: Date,
  rangeEnd: Date,
): Date[] {
  const results: Date[] = [];
  const inRange = (d: Date) => d >= rangeStart && d <= rangeEnd;

  switch (filingTypeId) {
    // Year-end-based annual types: loop year-ends to find all deadlines in range
    case 'corporation_tax_payment':
    case 'ct600_filing':
    case 'companies_house': {
      if (!client.year_end_date) break;
      const calc =
        filingTypeId === 'corporation_tax_payment' ? calculateCorporationTaxPayment :
        filingTypeId === 'ct600_filing' ? calculateCT600Filing :
        calculateCompaniesHouseAccounts;
      let ye = addYears(new UTCDate(client.year_end_date), -2);
      for (let i = 0; i < 10; i++) {
        const d = calc(ye);
        if (d > rangeEnd) break;
        if (inRange(d)) results.push(d);
        ye = addYears(ye, 1);
      }
      break;
    }

    case 'vat_return': {
      const sg = client.vat_stagger_group as VatStaggerGroup | null;
      if (!sg) break;
      const startYear = rangeStart.getFullYear() - 1;
      const endYear = rangeEnd.getFullYear() + 1;
      for (let y = startYear; y <= endYear; y++) {
        for (const qe of getStaggerQuarterEnds(sg, y)) {
          const d = calculateVATDeadline(qe);
          if (d > rangeEnd) continue;
          if (inRange(d)) results.push(d);
        }
      }
      break;
    }

    case 'self_assessment':
    case 'partnership_tax_return':
    case 'trust_tax_return': {
      const startYear = rangeStart.getFullYear() - 1;
      const endYear = rangeEnd.getFullYear() + 1;
      for (let y = startYear; y <= endYear; y++) {
        const d = calculateSelfAssessmentDeadline(y);
        if (inRange(d)) results.push(d);
      }
      break;
    }

    case 'mtd_quarterly_update': {
      // Enumerate quarter deadlines across years in range
      let from = new Date(rangeStart.getTime() - 90 * 86400000); // start earlier to catch nearby
      for (let i = 0; i < 20; i++) {
        const d = getNextMTDQuarterDeadline(from);
        if (d > rangeEnd) break;
        if (inRange(d)) results.push(d);
        from = addDays(d, 1);
      }
      break;
    }

    case 'confirmation_statement': {
      if (!client.incorporation_date) break;
      const incDate = new Date(client.incorporation_date);
      let d = calculateConfirmationStatementDeadline(incDate, new Date(rangeStart.getTime() - 365 * 86400000));
      for (let i = 0; i < 10; i++) {
        if (d > rangeEnd) break;
        if (inRange(d)) results.push(d);
        d = addYears(d, 1);
      }
      break;
    }

    case 'p11d_filing': {
      for (let y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear() + 1; y++) {
        const d = new UTCDate(y, 6, 6); // Jul 6
        if (inRange(d)) results.push(d);
      }
      break;
    }

    case 'payroll_year_end': {
      for (let y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear() + 1; y++) {
        const d = new UTCDate(y, 3, 19); // Apr 19
        if (inRange(d)) results.push(d);
      }
      break;
    }

    case 'sa_payment_on_account': {
      for (let y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear() + 1; y++) {
        const d = new UTCDate(y, 6, 31); // Jul 31
        if (inRange(d)) results.push(d);
      }
      break;
    }

    case 'paye_monthly': {
      // 22nd of each month
      let m = startOfMonth(rangeStart);
      while (m <= rangeEnd) {
        const d = new UTCDate(m.getFullYear(), m.getMonth(), 22);
        if (inRange(d)) results.push(d);
        m = addMonths(m, 1);
      }
      break;
    }

    case 'cis_monthly_return': {
      // 19th of each month
      let m = startOfMonth(rangeStart);
      while (m <= rangeEnd) {
        const d = new UTCDate(m.getFullYear(), m.getMonth(), 19);
        if (inRange(d)) results.push(d);
        m = addMonths(m, 1);
      }
      break;
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Time bucket generation
// ---------------------------------------------------------------------------

interface TimeBucket {
  label: string;
  isoKey: string;
  start: Date;
  end: Date;
  isCurrent: boolean;
}

function buildBuckets(timeframe: ForecastTimeframe): TimeBucket[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  switch (timeframe) {
    case 'this-week': {
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
        .filter(d => d.getDay() !== 0 && d.getDay() !== 6); // Mon-Fri
      return days.map(d => ({
        label: format(d, 'EEE'),
        isoKey: format(d, 'yyyy-MM-dd'),
        start: d,
        end: d,
        isCurrent: format(d, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd'),
      }));
    }

    case '4-weeks': {
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const rangeEnd = addDays(weekStart, 27); // 4 weeks
      const weeks = eachWeekOfInterval({ start: weekStart, end: rangeEnd }, { weekStartsOn: 1 });
      return weeks.slice(0, 4).map((ws, i) => {
        const we = endOfWeek(ws, { weekStartsOn: 1 });
        return {
          label: i === 0 ? 'This week' : format(ws, 'd MMM'),
          isoKey: format(ws, 'yyyy-MM-dd'),
          start: ws,
          end: we,
          isCurrent: i === 0,
        };
      });
    }

    case '6-months': {
      const monthStart = startOfMonth(now);
      const rangeEnd = endOfMonth(addMonths(monthStart, 5));
      const months = eachMonthOfInterval({ start: monthStart, end: rangeEnd });
      return months.map(m => ({
        label: format(m, 'MMM'),
        isoKey: format(m, 'yyyy-MM'),
        start: startOfMonth(m),
        end: endOfMonth(m),
        isCurrent: format(m, 'yyyy-MM') === format(now, 'yyyy-MM'),
      }));
    }

    case '12-months': {
      const monthStart = startOfMonth(now);
      const rangeEnd = endOfMonth(addMonths(monthStart, 11));
      const months = eachMonthOfInterval({ start: monthStart, end: rangeEnd });
      return months.map(m => ({
        label: format(m, 'MMM'),
        isoKey: format(m, 'yyyy-MM'),
        start: startOfMonth(m),
        end: endOfMonth(m),
        isCurrent: format(m, 'yyyy-MM') === format(now, 'yyyy-MM'),
      }));
    }
  }
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function getWorkloadForecast(
  supabase: SupabaseClient,
  timeframe: ForecastTimeframe = '6-months',
): Promise<ForecastBucket[]> {
  // Fetch active (non-paused) clients
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, year_end_date, vat_stagger_group, reminders_paused, records_received_for, completed_for')
    .eq('reminders_paused', false);

  if (clientsError) throw clientsError;

  // Fetch active filing assignments
  const { data: assignments, error: assignmentsError } = await supabase
    .from('client_filing_assignments')
    .select('client_id, filing_type_id')
    .eq('is_active', true);

  if (assignmentsError) throw assignmentsError;

  // Fetch org-level active filing types
  const { data: orgActiveTypes } = await supabase
    .from('org_filing_type_selections')
    .select('filing_type_id')
    .eq('is_active', true);
  const orgActiveSet = new Set((orgActiveTypes ?? []).map(r => r.filing_type_id));

  // Build buckets
  const buckets = buildBuckets(timeframe);
  // Use today as the effective start so we don't include past deadlines
  // (e.g. CIS on Mar 19 when today is Mar 21 — that deadline already passed)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeStart = today > buckets[0].start ? today : buckets[0].start;
  const rangeEnd = buckets[buckets.length - 1].end;

  // Init breakdown per bucket
  const breakdowns: BucketStatusBreakdown[] = buckets.map(() => ({
    red: 0, orange: 0, amber: 0, blue: 0, violet: 0, green: 0,
  }));

  // Group assignments by client, filtered by org-level active
  const clientAssignmentMap = new Map<string, string[]>();
  for (const a of assignments || []) {
    if (orgActiveSet.size > 0 && !orgActiveSet.has(a.filing_type_id)) continue;
    const list = clientAssignmentMap.get(a.client_id) || [];
    list.push(a.filing_type_id);
    clientAssignmentMap.set(a.client_id, list);
  }

  // Process each client
  for (const client of clients || []) {
    const filingTypes = clientAssignmentMap.get(client.id) || [];
    const recordsReceivedFor: string[] = Array.isArray(client.records_received_for) ? client.records_received_for : [];
    const completedFor: string[] = Array.isArray(client.completed_for) ? client.completed_for : [];

    for (const filingTypeId of filingTypes) {
      const deadlines = allDeadlinesInRange(filingTypeId, client, rangeStart, rangeEnd);

      for (const deadline of deadlines) {
        // Find which bucket this deadline falls into
        const bucketIdx = buckets.findIndex(b => deadline >= b.start && deadline <= b.end);
        if (bucketIdx < 0) continue;

        // Calculate status as-of-today
        const status = calculateFilingTypeStatus({
          filing_type_id: filingTypeId,
          deadline_date: format(deadline, 'yyyy-MM-dd'),
          is_records_received: recordsReceivedFor.includes(filingTypeId),
          is_completed: completedFor.includes(filingTypeId),
          override_status: null,
        });

        // Skip grey (shouldn't happen since we filter paused, but safety)
        if (status === 'grey') continue;

        breakdowns[bucketIdx][status]++;
      }
    }
  }

  return buckets.map((bucket, i) => {
    const bd = breakdowns[i];
    return {
      label: bucket.label,
      isoKey: bucket.isoKey,
      isCurrent: bucket.isCurrent,
      breakdown: bd,
      total: bd.red + bd.orange + bd.amber + bd.blue + bd.violet + bd.green,
    };
  });
}
