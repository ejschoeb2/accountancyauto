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
  mtd_quarterly_update: 'Quarterly: 7 Aug, 7 Nov, 7 Feb, 7 May',
  confirmation_statement: 'Incorporation anniversary + 14 days',
  p11d_filing: '6 July each year',
  paye_monthly: '22nd of each month',
  cis_monthly_return: '19th of each month',
  payroll_year_end: '19 April each year',
  sa_payment_on_account: '31 July each year',
  partnership_tax_return: '31 January following the tax year',
  trust_tax_return: '31 January following the tax year',
}
