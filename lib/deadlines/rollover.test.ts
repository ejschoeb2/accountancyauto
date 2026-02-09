import { describe, it, expect } from 'vitest';
import { rolloverDeadline } from './rollover';

describe('Year-on-Year Deadline Rollover', () => {
  describe('Corporation Tax Payment', () => {
    it('should rollover from 2026-01-01 to 2027-01-01 (year-end March 31)', () => {
      const yearEnd = new Date('2025-03-31');
      const currentDeadline = new Date('2026-01-01');
      const nextDeadline = rolloverDeadline(
        'corporation_tax_payment',
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
        'corporation_tax_payment',
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
      const nextDeadline = rolloverDeadline('ct600_filing', yearEnd, null, currentDeadline);
      expect(nextDeadline.toISOString().split('T')[0]).toBe('2027-03-31');
    });
  });

  describe('Companies House Accounts', () => {
    it('should rollover from 2025-12-31 to 2026-12-31', () => {
      const yearEnd = new Date('2025-03-31');
      const currentDeadline = new Date('2025-12-31');
      const nextDeadline = rolloverDeadline(
        'companies_house',
        yearEnd,
        null,
        currentDeadline
      );
      expect(nextDeadline.toISOString().split('T')[0]).toBe('2026-12-31');
    });
  });

  describe('VAT Return - Stagger 1 (Mar/Jun/Sep/Dec)', () => {
    it('should rollover from Q1 deadline to Q2 deadline', () => {
      const currentDeadline = new Date('2025-05-07'); // Q1 (Mar 31) deadline
      const nextDeadline = rolloverDeadline('vat_return', null, 1, currentDeadline);
      // Next quarter end after May 7 is Jun 30, deadline is Aug 7
      expect(nextDeadline.toISOString().split('T')[0]).toBe('2025-08-07');
    });

    it('should rollover from Q4 to Q1 of next year', () => {
      const currentDeadline = new Date('2025-02-07'); // Q4 2024 (Dec 31) deadline
      const nextDeadline = rolloverDeadline('vat_return', null, 1, currentDeadline);
      // Next quarter end after Feb 7 is Mar 31, deadline is May 7
      expect(nextDeadline.toISOString().split('T')[0]).toBe('2025-05-07');
    });

    it('should produce sequential deadlines through multiple rollovers', () => {
      let deadline = new Date('2025-02-07'); // Starting from Q4 2024 deadline
      const deadlines = [deadline];

      for (let i = 0; i < 3; i++) {
        deadline = rolloverDeadline('vat_return', null, 1, deadline);
        deadlines.push(deadline);
      }

      expect(deadlines.length).toBe(4);
      expect(deadlines[1].toISOString().split('T')[0]).toBe('2025-05-07'); // Q1
      expect(deadlines[2].toISOString().split('T')[0]).toBe('2025-08-07'); // Q2
      expect(deadlines[3].toISOString().split('T')[0]).toBe('2025-11-07'); // Q3
    });
  });

  describe('VAT Return - Stagger 2 (Jan/Apr/Jul/Oct)', () => {
    it('should rollover from Q1 (Jan) deadline to Q2 (Apr) deadline', () => {
      const currentDeadline = new Date('2025-03-07'); // Jan 31 quarter-end -> deadline Mar 7
      const nextDeadline = rolloverDeadline('vat_return', null, 2, currentDeadline);
      // Next quarter end after Mar 7 is Apr 30, deadline is Jun 7
      expect(nextDeadline.toISOString().split('T')[0]).toBe('2025-06-07');
    });

    it('should produce 4 sequential deadlines for Stagger 2', () => {
      let deadline = new Date('2025-03-07'); // Jan 31 -> Mar 7
      const deadlines = [deadline];

      for (let i = 0; i < 3; i++) {
        deadline = rolloverDeadline('vat_return', null, 2, deadline);
        deadlines.push(deadline);
      }

      expect(deadlines[1].toISOString().split('T')[0]).toBe('2025-06-07'); // Apr 30 -> Jun 7
      expect(deadlines[2].toISOString().split('T')[0]).toBe('2025-09-07'); // Jul 31 -> Sep 7
      expect(deadlines[3].toISOString().split('T')[0]).toBe('2025-12-07'); // Oct 31 -> Dec 7
    });
  });

  describe('VAT Return - Stagger 3 (Feb/May/Aug/Nov)', () => {
    it('should rollover from Q1 (Feb) deadline to Q2 (May) deadline', () => {
      const currentDeadline = new Date('2025-04-07'); // Feb 28 quarter-end -> deadline Apr 7
      const nextDeadline = rolloverDeadline('vat_return', null, 3, currentDeadline);
      // Next quarter end after Apr 7 is May 31, deadline is Jul 7
      expect(nextDeadline.toISOString().split('T')[0]).toBe('2025-07-07');
    });

    it('should produce 4 sequential deadlines for Stagger 3', () => {
      let deadline = new Date('2025-04-07'); // Feb 28 -> Apr 7
      const deadlines = [deadline];

      for (let i = 0; i < 3; i++) {
        deadline = rolloverDeadline('vat_return', null, 3, deadline);
        deadlines.push(deadline);
      }

      expect(deadlines[1].toISOString().split('T')[0]).toBe('2025-07-07'); // May 31 -> Jul 7
      expect(deadlines[2].toISOString().split('T')[0]).toBe('2025-10-07'); // Aug 31 -> Oct 7
      expect(deadlines[3].toISOString().split('T')[0]).toBe('2026-01-07'); // Nov 30 -> Jan 7
    });
  });

  describe('Self Assessment', () => {
    it('should rollover from 2026-01-31 to 2027-01-31', () => {
      const currentDeadline = new Date('2026-01-31');
      const nextDeadline = rolloverDeadline('self_assessment', null, null, currentDeadline);
      expect(nextDeadline.toISOString().split('T')[0]).toBe('2027-01-31');
    });
  });
});
