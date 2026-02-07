import { addYears, getYear } from 'date-fns';
import { UTCDate } from '@date-fns/utc';
import {
  calculateCorporationTaxPayment,
  calculateCT600Filing,
  calculateCompaniesHouseAccounts,
  calculateVATDeadline,
  calculateSelfAssessmentDeadline,
  getVATQuarterEnds,
  VatQuarterEnum,
} from './calculators';

/**
 * Calculate the next deadline for a given filing type
 * Advances by one cycle (year or quarter) and recalculates deadline
 *
 * @param filingTypeId - The type of filing (corporation-tax-payment, ct600-filing, etc.)
 * @param yearEndDate - The company's year-end date (for annual filings)
 * @param vatQuarter - The VAT quarter pattern (for quarterly VAT returns)
 * @param currentDeadline - The current deadline to roll over from
 * @returns The next deadline date
 */
export function rolloverDeadline(
  filingTypeId: string,
  yearEndDate: Date | null,
  vatQuarter: string | null,
  currentDeadline: Date
): Date {
  const utcCurrentDeadline = new UTCDate(currentDeadline);

  switch (filingTypeId) {
    case 'corporation_tax_payment': {
      if (!yearEndDate) {
        throw new Error('yearEndDate required for corporation-tax-payment rollover');
      }
      // Advance year-end by 1 year and recalculate deadline
      const nextYearEnd = addYears(new UTCDate(yearEndDate), 1);
      return calculateCorporationTaxPayment(nextYearEnd);
    }

    case 'ct600_filing': {
      if (!yearEndDate) {
        throw new Error('yearEndDate required for ct600-filing rollover');
      }
      // Advance year-end by 1 year and recalculate deadline
      const nextYearEnd = addYears(new UTCDate(yearEndDate), 1);
      return calculateCT600Filing(nextYearEnd);
    }

    case 'companies_house': {
      if (!yearEndDate) {
        throw new Error('yearEndDate required for companies-house-accounts rollover');
      }
      // Advance year-end by 1 year and recalculate deadline
      const nextYearEnd = addYears(new UTCDate(yearEndDate), 1);
      return calculateCompaniesHouseAccounts(nextYearEnd);
    }

    case 'vat_return': {
      if (!vatQuarter) {
        throw new Error('vatQuarter required for vat-return rollover');
      }

      // Determine which quarter we're currently in based on the deadline
      const currentYear = getYear(utcCurrentDeadline);
      const currentMonth = utcCurrentDeadline.getUTCMonth();

      // Map deadline months to next quarter
      // May deadline (Q1 Jan-Mar) -> next is Q2 Apr-Jun
      // Aug deadline (Q2 Apr-Jun) -> next is Q3 Jul-Sep
      // Nov deadline (Q3 Jul-Sep) -> next is Q4 Oct-Dec
      // Feb deadline (Q4 Oct-Dec) -> next is Q1 Jan-Mar (next year)

      let nextQuarter: VatQuarterEnum;
      let nextYear = currentYear;

      if (currentMonth >= 1 && currentMonth <= 4) {
        // Feb-May: Currently Q4 or Q1, next is Q1 or Q2
        if (currentMonth <= 1) {
          // Feb (Q4 of previous year) -> Q1
          nextQuarter = 'Jan-Mar';
        } else {
          // Mar-May (Q1) -> Q2
          nextQuarter = 'Apr-Jun';
        }
      } else if (currentMonth >= 5 && currentMonth <= 7) {
        // Jun-Aug: Currently Q2, next is Q3
        nextQuarter = 'Jul-Sep';
      } else if (currentMonth >= 8 && currentMonth <= 10) {
        // Sep-Nov: Currently Q3, next is Q4
        nextQuarter = 'Oct-Dec';
      } else {
        // Dec-Jan: Currently Q4, next is Q1 of next year
        nextQuarter = 'Jan-Mar';
        nextYear = currentYear + 1;
      }

      const nextQuarterEnds = getVATQuarterEnds(nextQuarter, nextYear);
      return calculateVATDeadline(nextQuarterEnds[0]);
    }

    case 'self_assessment': {
      // Always Jan 31, advance by 1 year
      return addYears(utcCurrentDeadline, 1);
    }

    default:
      throw new Error(`Unknown filing type: ${filingTypeId}`);
  }
}
