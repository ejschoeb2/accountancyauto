import { addYears } from 'date-fns';
import { UTCDate } from '@date-fns/utc';
import {
  calculateCorporationTaxPayment,
  calculateCT600Filing,
  calculateCompaniesHouseAccounts,
  calculateVATDeadline,
  getNextQuarterEnd,
  VatStaggerGroup,
} from './calculators';

/**
 * Calculate the next deadline for a given filing type
 * Advances by one cycle (year or quarter) and recalculates deadline
 *
 * @param filingTypeId - The type of filing (corporation_tax_payment, ct600_filing, etc.)
 * @param yearEndDate - The company's year-end date (for annual filings)
 * @param vatStaggerGroup - The VAT stagger group 1/2/3 (for quarterly VAT returns)
 * @param currentDeadline - The current deadline to roll over from
 * @returns The next deadline date
 */
export function rolloverDeadline(
  filingTypeId: string,
  yearEndDate: Date | null,
  vatStaggerGroup: number | null,
  currentDeadline: Date
): Date {
  switch (filingTypeId) {
    case 'corporation_tax_payment': {
      if (!yearEndDate) {
        throw new Error('yearEndDate required for corporation_tax_payment rollover');
      }
      // Advance year-end by 1 year and recalculate deadline
      const nextYearEnd = addYears(new UTCDate(yearEndDate), 1);
      return calculateCorporationTaxPayment(nextYearEnd);
    }

    case 'ct600_filing': {
      if (!yearEndDate) {
        throw new Error('yearEndDate required for ct600_filing rollover');
      }
      // Advance year-end by 1 year and recalculate deadline
      const nextYearEnd = addYears(new UTCDate(yearEndDate), 1);
      return calculateCT600Filing(nextYearEnd);
    }

    case 'companies_house': {
      if (!yearEndDate) {
        throw new Error('yearEndDate required for companies_house rollover');
      }
      // Advance year-end by 1 year and recalculate deadline
      const nextYearEnd = addYears(new UTCDate(yearEndDate), 1);
      return calculateCompaniesHouseAccounts(nextYearEnd);
    }

    case 'vat_return': {
      if (!vatStaggerGroup) {
        throw new Error('vatStaggerGroup required for vat_return rollover');
      }

      // Find the next quarter-end after the current deadline and calculate VAT deadline from it
      const nextQuarterEnd = getNextQuarterEnd(vatStaggerGroup as VatStaggerGroup, currentDeadline);
      return calculateVATDeadline(nextQuarterEnd);
    }

    case 'self_assessment': {
      // Always Jan 31, advance by 1 year
      return addYears(new UTCDate(currentDeadline), 1);
    }

    default:
      throw new Error(`Unknown filing type: ${filingTypeId}`);
  }
}
