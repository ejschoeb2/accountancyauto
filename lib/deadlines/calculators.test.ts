import { describe, it, expect } from 'vitest';
import {
  calculateCorporationTaxPayment,
  calculateCT600Filing,
  calculateCompaniesHouseAccounts,
  calculateVATDeadline,
  calculateSelfAssessmentDeadline,
  getVATQuarterEnds,
} from './calculators';

describe('UK Filing Deadline Calculators', () => {
  describe('calculateCorporationTaxPayment', () => {
    it('should add 9 months + 1 day to year-end date (2025-03-31)', () => {
      const yearEnd = new Date('2025-03-31');
      const deadline = calculateCorporationTaxPayment(yearEnd);
      expect(deadline.toISOString().split('T')[0]).toBe('2026-01-01');
    });

    it('should add 9 months + 1 day to year-end date (2025-12-31)', () => {
      const yearEnd = new Date('2025-12-31');
      const deadline = calculateCorporationTaxPayment(yearEnd);
      expect(deadline.toISOString().split('T')[0]).toBe('2026-10-01');
    });

    it('should handle leap year correctly (2024-02-29)', () => {
      const yearEnd = new Date('2024-02-29');
      const deadline = calculateCorporationTaxPayment(yearEnd);
      expect(deadline.toISOString().split('T')[0]).toBe('2024-11-30');
    });
  });

  describe('calculateCT600Filing', () => {
    it('should add 12 months to year-end date (2025-03-31)', () => {
      const yearEnd = new Date('2025-03-31');
      const deadline = calculateCT600Filing(yearEnd);
      expect(deadline.toISOString().split('T')[0]).toBe('2026-03-31');
    });

    it('should add 12 months to year-end date (2025-06-30)', () => {
      const yearEnd = new Date('2025-06-30');
      const deadline = calculateCT600Filing(yearEnd);
      expect(deadline.toISOString().split('T')[0]).toBe('2026-06-30');
    });
  });

  describe('calculateCompaniesHouseAccounts', () => {
    it('should add 9 months to year-end date (2025-03-31)', () => {
      const yearEnd = new Date('2025-03-31');
      const deadline = calculateCompaniesHouseAccounts(yearEnd);
      expect(deadline.toISOString().split('T')[0]).toBe('2025-12-31');
    });

    it('should add 9 months to year-end date (2025-06-30)', () => {
      const yearEnd = new Date('2025-06-30');
      const deadline = calculateCompaniesHouseAccounts(yearEnd);
      expect(deadline.toISOString().split('T')[0]).toBe('2026-03-30');
    });
  });

  describe('calculateVATDeadline', () => {
    it('should add 1 month + 7 days to quarter-end (2025-03-31)', () => {
      const quarterEnd = new Date('2025-03-31');
      const deadline = calculateVATDeadline(quarterEnd);
      expect(deadline.toISOString().split('T')[0]).toBe('2025-05-07');
    });

    it('should add 1 month + 7 days to quarter-end (2025-06-30)', () => {
      const quarterEnd = new Date('2025-06-30');
      const deadline = calculateVATDeadline(quarterEnd);
      expect(deadline.toISOString().split('T')[0]).toBe('2025-08-07');
    });

    it('should add 1 month + 7 days to quarter-end (2025-12-31)', () => {
      const quarterEnd = new Date('2025-12-31');
      const deadline = calculateVATDeadline(quarterEnd);
      expect(deadline.toISOString().split('T')[0]).toBe('2026-02-07');
    });
  });

  describe('calculateSelfAssessmentDeadline', () => {
    it('should return 31 Jan following tax year ending 2025-04-05', () => {
      const deadline = calculateSelfAssessmentDeadline(2025);
      expect(deadline.toISOString().split('T')[0]).toBe('2026-01-31');
    });

    it('should return 31 Jan following tax year ending 2026-04-05', () => {
      const deadline = calculateSelfAssessmentDeadline(2026);
      expect(deadline.toISOString().split('T')[0]).toBe('2027-01-31');
    });
  });

  describe('getVATQuarterEnds', () => {
    it('should return correct date for Jan-Mar 2025', () => {
      const quarterEnds = getVATQuarterEnds('Jan-Mar', 2025);
      expect(quarterEnds).toHaveLength(1);
      expect(quarterEnds[0].toISOString().split('T')[0]).toBe('2025-03-31');
    });

    it('should return correct date for Apr-Jun 2025', () => {
      const quarterEnds = getVATQuarterEnds('Apr-Jun', 2025);
      expect(quarterEnds).toHaveLength(1);
      expect(quarterEnds[0].toISOString().split('T')[0]).toBe('2025-06-30');
    });

    it('should return correct date for Jul-Sep 2025', () => {
      const quarterEnds = getVATQuarterEnds('Jul-Sep', 2025);
      expect(quarterEnds).toHaveLength(1);
      expect(quarterEnds[0].toISOString().split('T')[0]).toBe('2025-09-30');
    });

    it('should return correct date for Oct-Dec 2025', () => {
      const quarterEnds = getVATQuarterEnds('Oct-Dec', 2025);
      expect(quarterEnds).toHaveLength(1);
      expect(quarterEnds[0].toISOString().split('T')[0]).toBe('2025-12-31');
    });
  });
});
