import type { FilingTypeId } from '@/lib/types/database';

export const FILING_TYPE_LABELS: Record<FilingTypeId | string, string> = {
  corporation_tax_payment: 'Corp Tax',
  ct600_filing: 'CT600',
  companies_house: 'Companies House',
  vat_return: 'VAT Return',
  self_assessment: 'Self Assessment',
  mtd_quarterly_update: 'MTD Quarterly Return',
  confirmation_statement: 'Confirmation Statement',
  p11d_filing: 'P11D',
  paye_monthly: 'PAYE Monthly',
  cis_monthly_return: 'CIS Monthly Return',
  payroll_year_end: 'Payroll Year End',
  sa_payment_on_account: 'SA Payment on Account',
  partnership_tax_return: 'Partnership Tax Return',
  trust_tax_return: 'Trust Tax Return',
};

export const ALL_FILING_TYPE_IDS = Object.keys(FILING_TYPE_LABELS) as FilingTypeId[];

/** Filing types applicable to each client type (mirrors DB applicable_client_types) */
export const FILING_TYPES_BY_CLIENT_TYPE: Record<string, FilingTypeId[]> = {
  'Limited Company': [
    'corporation_tax_payment', 'ct600_filing', 'companies_house', 'vat_return',
    'confirmation_statement', 'p11d_filing', 'paye_monthly', 'cis_monthly_return', 'payroll_year_end',
  ],
  'LLP': [
    'corporation_tax_payment', 'ct600_filing', 'companies_house', 'vat_return',
    'confirmation_statement', 'p11d_filing', 'paye_monthly', 'cis_monthly_return', 'payroll_year_end',
  ],
  'Partnership': [
    'partnership_tax_return', 'vat_return',
  ],
  'Individual': [
    'self_assessment', 'mtd_quarterly_update', 'sa_payment_on_account', 'trust_tax_return',
  ],
};

export function getFilingTypeLabel(id: string | null | undefined): string {
  if (!id) return '—';
  return FILING_TYPE_LABELS[id] || id;
}
