import type { FilingTypeId } from '@/lib/types/database'

/**
 * Human-readable deadline calculation rules for each filing type.
 * Mirrors the logic in calculators.ts as plain English.
 */
export const DEADLINE_DESCRIPTIONS: Record<FilingTypeId, string> = {
  corporation_tax_payment: 'Year-end + 9 months + 1 day',
  ct600_filing: 'Year-end + 12 months',
  companies_house: 'Year-end + 9 months',
  vat_return: 'Quarter-end + 1 month + 7 days',
  self_assessment: '31 January following the tax year',
}
