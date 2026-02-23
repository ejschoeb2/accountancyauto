import { addYears } from 'date-fns';
import { FilingTypeId } from '@/lib/types/database';

/**
 * Calculate the statutory retention deadline for a document.
 *
 * Retention rules (HMRC CH14600 + TMA 1970 s12B):
 * - Self Assessment (individual): retain until 5 years after the January 31 filing
 *   deadline immediately following the tax year end.
 *   Example: tax year ends 2025-04-05 → Jan 31 deadline = 2026-01-31 → retain until 2031-01-31
 * - All other filing types (company): retain until 6 years after the tax period end date.
 *   Example: period ends 2024-12-31 → retain until 2030-12-31
 *
 * @param filingType - The filing type identifier
 * @param taxPeriodEndDate - The end date of the relevant tax period (retention anchor)
 * @returns The date on or after which the document may be deleted (if no retention_hold)
 */
export function calculateRetainUntil(filingType: FilingTypeId, taxPeriodEndDate: Date): Date {
  if (filingType === 'self_assessment') {
    // Individual filing: anchor to January 31 immediately following the tax year end
    // Tax year ends 5 April YYYY → filing deadline is Jan 31 of YYYY+1 (month index 0 = January)
    const jan31Deadline = new Date(taxPeriodEndDate.getFullYear() + 1, 0, 31);
    return addYears(jan31Deadline, 5);
  }

  // Company filings (ct600_filing, vat_return, companies_house, corporation_tax_payment):
  // anchor to the tax period end date directly
  return addYears(taxPeriodEndDate, 6);
}
