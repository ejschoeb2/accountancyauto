import { describe, it, expect } from 'vitest';
import { rolloverDeadline } from './rollover';

describe('Year-on-Year Deadline Rollover', () => {
  describe('Corporation Tax Payment', () => {
    it('should rollover from 2026-01-01 to 2027-01-01 (year-end March 31)', () => {
      const yearEnd = new Date('2025-03-31');
      const currentDeadline = new Date('2026-01-01');
      const nextDeadline = rolloverDeadline(
        'corporation-tax-payment',
        yearEnd,
        null,
        currentDeadline
      );
      expect(nextDeadline.toISOString().split('T')[0]).toBe('2027-01-01');
    });

    it('should handle leap year year-end rollover (Feb 29 -> non-leap year)', () => {
      const yearEnd = new Date('2024-02-29'); // Leap year
      const currentDeadline = new Date('2024-11-30');
      const nextDeadline = rolloverDeadline(
        'corporation-tax-payment',
        yearEnd,
        null,
        currentDeadline
      );
      // Next year-end would be 2025-02-28 (not leap year)
      // 2025-02-28 + 9 months + 1 day = 2025-11-29
      expect(nextDeadline.toISOString().split('T')[0]).toBe('2025-11-29');
    });
  });

  describe('CT600 Filing', () => {
    it('should rollover from 2026-03-31 to 2027-03-31', () => {
      const yearEnd = new Date('2025-03-31');
      const currentDeadline = new Date('2026-03-31');
      const nextDeadline = rolloverDeadline('ct600-filing', yearEnd, null, currentDeadline);
      expect(nextDeadline.toISOString().split('T')[0]).toBe('2027-03-31');
    });
  });

  describe('Companies House Accounts', () => {
    it('should rollover from 2025-12-31 to 2026-12-31', () => {
      const yearEnd = new Date('2025-03-31');
      const currentDeadline = new Date('2025-12-31');
      const nextDeadline = rolloverDeadline(
        'companies-house-accounts',
        yearEnd,
        null,
        currentDeadline
      );
      expect(nextDeadline.toISOString().split('T')[0]).toBe('2026-12-31');
    });
  });

  describe('VAT Return (Quarterly)', () => {
    it('should rollover from Q1 to Q2 (Jan-Mar quarter)', () => {
      const currentDeadline = new Date('2025-05-07'); // Q1 deadline
      const nextDeadline = rolloverDeadline('vat-return', null, 'Jan-Mar', currentDeadline);
      // Next quarter end is 2025-06-30, deadline is 2025-08-07
      expect(nextDeadline.toISOString().split('T')[0]).toBe('2025-08-07');
    });

    it('should rollover from Q4 to Q1 of next year (Oct-Dec quarter)', () => {
      const currentDeadline = new Date('2025-02-07'); // Q4 2024 deadline
      const nextDeadline = rolloverDeadline('vat-return', null, 'Oct-Dec', currentDeadline);
      // Next quarter end is 2025-03-31, deadline is 2025-05-07
      expect(nextDeadline.toISOString().split('T')[0]).toBe('2025-05-07');
    });

    it('should produce 4 deadlines per year (test multiple rollovers)', () => {
      let deadline = new Date('2025-02-07'); // Q4 2024 deadline
      const deadlines = [deadline];

      for (let i = 0; i < 3; i++) {
        deadline = rolloverDeadline('vat-return', null, 'Oct-Dec', deadline);
        deadlines.push(deadline);
      }

      expect(deadlines.length).toBe(4);
      expect(deadlines[1].toISOString().split('T')[0]).toBe('2025-05-07'); // Q1
      expect(deadlines[2].toISOString().split('T')[0]).toBe('2025-08-07'); // Q2
      expect(deadlines[3].toISOString().split('T')[0]).toBe('2025-11-07'); // Q3
    });
  });

  describe('Self Assessment', () => {
    it('should rollover from 2026-01-31 to 2027-01-31', () => {
      const currentDeadline = new Date('2026-01-31');
      const nextDeadline = rolloverDeadline('self-assessment', null, null, currentDeadline);
      expect(nextDeadline.toISOString().split('T')[0]).toBe('2027-01-31');
    });
  });
});
