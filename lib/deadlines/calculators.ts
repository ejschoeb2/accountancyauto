import { addMonths, addDays, addYears, endOfMonth, isSameDay } from 'date-fns';
import { UTCDate } from '@date-fns/utc';

export type VatStaggerGroup = 1 | 2 | 3;

/**
 * Quarter-end months for each HMRC VAT stagger group (0-indexed)
 * Stagger 1: Mar(2), Jun(5), Sep(8), Dec(11)
 * Stagger 2: Jan(0), Apr(3), Jul(6), Oct(9)
 * Stagger 3: Feb(1), May(4), Aug(7), Nov(10)
 */
const STAGGER_MONTHS: Record<VatStaggerGroup, number[]> = {
  1: [2, 5, 8, 11],   // Mar, Jun, Sep, Dec
  2: [0, 3, 6, 9],    // Jan, Apr, Jul, Oct
  3: [1, 4, 7, 10],   // Feb, May, Aug, Nov
};

/**
 * Calculate Corporation Tax payment deadline (year-end + 9 months + 1 day)
 */
export function calculateCorporationTaxPayment(yearEndDate: Date): Date {
  const utcDate = new UTCDate(yearEndDate);
  const nineMonthsLater = addMonths(utcDate, 9);
  return addDays(nineMonthsLater, 1);
}

/**
 * Calculate CT600 filing deadline (year-end + 12 months)
 */
export function calculateCT600Filing(yearEndDate: Date): Date {
  const utcDate = new UTCDate(yearEndDate);
  return addYears(utcDate, 1);
}

/**
 * Calculate Companies House accounts deadline (year-end + 9 months for private companies)
 */
export function calculateCompaniesHouseAccounts(yearEndDate: Date): Date {
  const utcDate = new UTCDate(yearEndDate);
  return addMonths(utcDate, 9);
}

/**
 * Calculate VAT return deadline (quarter-end + 1 month + 7 days)
 * Special handling: if quarter ends on last day of month, advance to last day of next month
 */
export function calculateVATDeadline(quarterEndDate: Date): Date {
  const utcDate = new UTCDate(quarterEndDate);
  const oneMonthLater = addMonths(utcDate, 1);

  // If quarter end was end-of-month, ensure we're also at end-of-month after adding 1 month
  const endOfQuarter = endOfMonth(utcDate);
  const isEndOfMonth = isSameDay(utcDate, endOfQuarter);

  const adjustedDate = isEndOfMonth ? endOfMonth(oneMonthLater) : oneMonthLater;
  return addDays(adjustedDate, 7);
}

/**
 * Calculate Self Assessment deadline (always 31 January following tax year ending 5 April)
 * @param taxYearEndYear - The year the tax year ends (e.g., 2025 for tax year ending April 2025)
 */
export function calculateSelfAssessmentDeadline(taxYearEndYear: number): Date {
  // Tax year ending April 2025 -> deadline is 31 Jan 2026
  return new Date(taxYearEndYear + 1, 0, 31); // Month is 0-indexed, so 0 = January
}

/**
 * Get all 4 quarter-end dates for a stagger group in a given year
 */
export function getStaggerQuarterEnds(staggerGroup: VatStaggerGroup, year: number): Date[] {
  const months = STAGGER_MONTHS[staggerGroup];
  return months.map((month) => endOfMonth(new UTCDate(year, month, 1)));
}

/**
 * Find the next quarter-end date after a given date for a stagger group
 */
export function getNextQuarterEnd(staggerGroup: VatStaggerGroup, fromDate: Date): Date {
  const utcFrom = new UTCDate(fromDate);
  const year = utcFrom.getUTCFullYear();
  const months = STAGGER_MONTHS[staggerGroup];

  // Check quarter-ends in current year
  for (const month of months) {
    const quarterEnd = endOfMonth(new UTCDate(year, month, 1));
    if (quarterEnd > utcFrom) {
      return quarterEnd;
    }
  }

  // All quarter-ends in current year have passed, use first quarter-end of next year
  return endOfMonth(new UTCDate(year + 1, months[0], 1));
}

/**
 * Dispatcher function to calculate deadline based on filing type
 */
export function calculateDeadline(
  filingTypeId: string,
  clientMetadata: { year_end_date?: string; vat_stagger_group?: number }
): Date | null {
  const { year_end_date, vat_stagger_group } = clientMetadata;

  switch (filingTypeId) {
    case 'corporation_tax_payment':
      if (!year_end_date) return null;
      return calculateCorporationTaxPayment(new Date(year_end_date));

    case 'ct600_filing':
      if (!year_end_date) return null;
      return calculateCT600Filing(new Date(year_end_date));

    case 'companies_house':
      if (!year_end_date) return null;
      return calculateCompaniesHouseAccounts(new Date(year_end_date));

    case 'vat_return':
      if (!vat_stagger_group) return null;
      const nextQuarterEnd = getNextQuarterEnd(vat_stagger_group as VatStaggerGroup, new Date());
      return calculateVATDeadline(nextQuarterEnd);

    case 'self_assessment':
      const currentYear = new Date().getFullYear();
      return calculateSelfAssessmentDeadline(currentYear);

    default:
      return null;
  }
}
