import { describe, it, expect } from 'vitest';
import {
  calculateCorporationTaxPayment,
  calculateCT600Filing,
  calculateCompaniesHouseAccounts,
  calculateVATDeadline,
  calculateSelfAssessmentDeadline,
  getStaggerQuarterEnds,
  getNextQuarterEnd,
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

    it('should handle Stagger 2 quarter-end (2025-01-31)', () => {
      const quarterEnd = new Date('2025-01-31');
      const deadline = calculateVATDeadline(quarterEnd);
      // Jan 31 -> end of Feb (28) + 7 = Mar 7
      expect(deadline.toISOString().split('T')[0]).toBe('2025-03-07');
    });

    it('should handle Stagger 3 quarter-end (2025-02-28)', () => {
      const quarterEnd = new Date('2025-02-28');
      const deadline = calculateVATDeadline(quarterEnd);
      // Feb 28 (end of month) -> end of Mar (31) + 7 = Apr 7
      expect(deadline.toISOString().split('T')[0]).toBe('2025-04-07');
    });

    it('should handle Stagger 3 leap year quarter-end (2024-02-29)', () => {
      const quarterEnd = new Date('2024-02-29');
      const deadline = calculateVATDeadline(quarterEnd);
      // Feb 29 (end of month) -> end of Mar (31) + 7 = Apr 7
      expect(deadline.toISOString().split('T')[0]).toBe('2024-04-07');
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

  describe('getStaggerQuarterEnds', () => {
    it('should return correct dates for Stagger 1 (Mar/Jun/Sep/Dec)', () => {
      const quarterEnds = getStaggerQuarterEnds(1, 2025);
      expect(quarterEnds).toHaveLength(4);
      expect(quarterEnds[0].toISOString().split('T')[0]).toBe('2025-03-31');
      expect(quarterEnds[1].toISOString().split('T')[0]).toBe('2025-06-30');
      expect(quarterEnds[2].toISOString().split('T')[0]).toBe('2025-09-30');
      expect(quarterEnds[3].toISOString().split('T')[0]).toBe('2025-12-31');
    });

    it('should return correct dates for Stagger 2 (Jan/Apr/Jul/Oct)', () => {
      const quarterEnds = getStaggerQuarterEnds(2, 2025);
      expect(quarterEnds).toHaveLength(4);
      expect(quarterEnds[0].toISOString().split('T')[0]).toBe('2025-01-31');
      expect(quarterEnds[1].toISOString().split('T')[0]).toBe('2025-04-30');
      expect(quarterEnds[2].toISOString().split('T')[0]).toBe('2025-07-31');
      expect(quarterEnds[3].toISOString().split('T')[0]).toBe('2025-10-31');
    });

    it('should return correct dates for Stagger 3 (Feb/May/Aug/Nov)', () => {
      const quarterEnds = getStaggerQuarterEnds(3, 2025);
      expect(quarterEnds).toHaveLength(4);
      expect(quarterEnds[0].toISOString().split('T')[0]).toBe('2025-02-28');
      expect(quarterEnds[1].toISOString().split('T')[0]).toBe('2025-05-31');
      expect(quarterEnds[2].toISOString().split('T')[0]).toBe('2025-08-31');
      expect(quarterEnds[3].toISOString().split('T')[0]).toBe('2025-11-30');
    });

    it('should handle leap year for Stagger 3', () => {
      const quarterEnds = getStaggerQuarterEnds(3, 2024);
      expect(quarterEnds[0].toISOString().split('T')[0]).toBe('2024-02-29');
    });
  });

  describe('getNextQuarterEnd', () => {
    it('should find next Stagger 1 quarter-end after Jan 15', () => {
      const next = getNextQuarterEnd(1, new Date('2025-01-15'));
      expect(next.toISOString().split('T')[0]).toBe('2025-03-31');
    });

    it('should find next Stagger 1 quarter-end after Apr 1', () => {
      const next = getNextQuarterEnd(1, new Date('2025-04-01'));
      expect(next.toISOString().split('T')[0]).toBe('2025-06-30');
    });

    it('should wrap to next year when all quarters passed', () => {
      // Jan 1 2026 is after all 2025 Stagger 1 quarter-ends
      const next = getNextQuarterEnd(1, new Date('2026-01-01'));
      expect(next.toISOString().split('T')[0]).toBe('2026-03-31');
    });

    it('should find next Stagger 2 quarter-end after Feb 1', () => {
      const next = getNextQuarterEnd(2, new Date('2025-02-01'));
      expect(next.toISOString().split('T')[0]).toBe('2025-04-30');
    });

    it('should find next Stagger 3 quarter-end after Mar 1', () => {
      const next = getNextQuarterEnd(3, new Date('2025-03-01'));
      expect(next.toISOString().split('T')[0]).toBe('2025-05-31');
    });

    it('should return exact boundary date when fromDate is before it', () => {
      // From exactly Jan 30 (Stagger 2), next should be Jan 31
      const next = getNextQuarterEnd(2, new Date('2025-01-30'));
      expect(next.toISOString().split('T')[0]).toBe('2025-01-31');
    });
  });
});
