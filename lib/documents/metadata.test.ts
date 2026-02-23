import { describe, it, expect } from 'vitest';
import { calculateRetainUntil } from './metadata';

describe('calculateRetainUntil', () => {
  describe('self_assessment (individual — 5 years from January 31 following tax year end)', () => {
    it('SA100: 2025-04-05 → 2031-01-31 (CRITICAL: must be 2031, not 2030)', () => {
      const taxPeriodEndDate = new Date('2025-04-05');
      const result = calculateRetainUntil('self_assessment', taxPeriodEndDate);
      expect(result.toISOString().split('T')[0]).toBe('2031-01-31');
    });

    it('SA100: 2023-04-05 → 2029-01-31', () => {
      const taxPeriodEndDate = new Date('2023-04-05');
      const result = calculateRetainUntil('self_assessment', taxPeriodEndDate);
      expect(result.toISOString().split('T')[0]).toBe('2029-01-31');
    });
  });

  describe('company filing types (6 years from tax_period_end_date)', () => {
    it('ct600_filing: 2024-12-31 → 2030-12-31', () => {
      const taxPeriodEndDate = new Date('2024-12-31');
      const result = calculateRetainUntil('ct600_filing', taxPeriodEndDate);
      expect(result.toISOString().split('T')[0]).toBe('2030-12-31');
    });

    it('vat_return: 2024-03-31 → 2030-03-31', () => {
      const taxPeriodEndDate = new Date('2024-03-31');
      const result = calculateRetainUntil('vat_return', taxPeriodEndDate);
      expect(result.toISOString().split('T')[0]).toBe('2030-03-31');
    });

    it('companies_house: 2024-06-30 → 2030-06-30', () => {
      const taxPeriodEndDate = new Date('2024-06-30');
      const result = calculateRetainUntil('companies_house', taxPeriodEndDate);
      expect(result.toISOString().split('T')[0]).toBe('2030-06-30');
    });

    it('corporation_tax_payment: 2024-09-30 → 2030-09-30', () => {
      const taxPeriodEndDate = new Date('2024-09-30');
      const result = calculateRetainUntil('corporation_tax_payment', taxPeriodEndDate);
      expect(result.toISOString().split('T')[0]).toBe('2030-09-30');
    });
  });
});
