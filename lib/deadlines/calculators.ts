import { addMonths, addDays, addYears, endOfMonth, isSameDay } from 'date-fns';
import { UTCDate } from '@date-fns/utc';

export type VatQuarterEnum = 'Jan-Mar' | 'Apr-Jun' | 'Jul-Sep' | 'Oct-Dec';

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
 * Get the quarter-end date for a specific VAT quarter and year
 */
export function getVATQuarterEnds(quarter: VatQuarterEnum, year: number): Date[] {
  const quarterEndMap: Record<VatQuarterEnum, Date> = {
    'Jan-Mar': new Date(`${year}-03-31`), // March 31
    'Apr-Jun': new Date(`${year}-06-30`), // June 30
    'Jul-Sep': new Date(`${year}-09-30`), // September 30
    'Oct-Dec': new Date(`${year}-12-31`), // December 31
  };

  return [quarterEndMap[quarter]];
}

/**
 * Dispatcher function to calculate deadline based on filing type
 */
export function calculateDeadline(
  filingTypeId: string,
  clientMetadata: { year_end_date?: string; vat_quarter?: string }
): Date | null {
  const { year_end_date, vat_quarter } = clientMetadata;

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
      if (!vat_quarter) return null;
      const year = new Date().getFullYear();
      const quarterEnds = getVATQuarterEnds(vat_quarter as VatQuarterEnum, year);
      return calculateVATDeadline(quarterEnds[0]);

    case 'self_assessment':
      const currentYear = new Date().getFullYear();
      return calculateSelfAssessmentDeadline(currentYear);

    default:
      return null;
  }
}
