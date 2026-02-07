import { describe, it, expect } from 'vitest';
import { getNextWorkingDay, isWorkingDay } from './working-days';

describe('Working Day Calculation', () => {
  // Mock bank holidays for deterministic testing
  const mockBankHolidays = new Set([
    '2025-12-25', // Christmas Day (Thursday)
    '2025-12-26', // Boxing Day (Friday)
  ]);

  describe('isWorkingDay', () => {
    it('should return true for a regular Monday', () => {
      const monday = new Date('2025-01-06'); // Monday
      expect(isWorkingDay(monday, mockBankHolidays)).toBe(true);
    });

    it('should return false for Saturday', () => {
      const saturday = new Date('2025-01-04'); // Saturday
      expect(isWorkingDay(saturday, mockBankHolidays)).toBe(false);
    });

    it('should return false for Sunday', () => {
      const sunday = new Date('2025-01-05'); // Sunday
      expect(isWorkingDay(sunday, mockBankHolidays)).toBe(false);
    });

    it('should return false for bank holiday (Christmas Thursday)', () => {
      const christmas = new Date('2025-12-25'); // Thursday but bank holiday
      expect(isWorkingDay(christmas, mockBankHolidays)).toBe(false);
    });

    it('should return true for Wednesday (not a bank holiday)', () => {
      const wednesday = new Date('2025-01-08'); // Wednesday
      expect(isWorkingDay(wednesday, mockBankHolidays)).toBe(true);
    });
  });

  describe('getNextWorkingDay', () => {
    it('should return same date for regular Monday', () => {
      const monday = new Date('2025-01-06');
      const result = getNextWorkingDay(monday, mockBankHolidays);
      expect(result.toISOString().split('T')[0]).toBe('2025-01-06');
    });

    it('should skip Saturday to Monday', () => {
      const saturday = new Date('2025-01-04');
      const result = getNextWorkingDay(saturday, mockBankHolidays);
      expect(result.toISOString().split('T')[0]).toBe('2025-01-06');
    });

    it('should skip Sunday to Monday', () => {
      const sunday = new Date('2025-01-05');
      const result = getNextWorkingDay(sunday, mockBankHolidays);
      expect(result.toISOString().split('T')[0]).toBe('2025-01-06');
    });

    it('should skip Christmas (Thursday) and Boxing Day (Friday) and weekend to Monday', () => {
      const christmas = new Date('2025-12-25'); // Thursday
      const result = getNextWorkingDay(christmas, mockBankHolidays);
      expect(result.toISOString().split('T')[0]).toBe('2025-12-29'); // Monday
    });

    it('should skip Wednesday bank holiday to Thursday (if Thursday is working day)', () => {
      const wednesdayHoliday = new Date('2025-01-01'); // New Year's Day (Wednesday)
      const holidays = new Set(['2025-01-01']);
      const result = getNextWorkingDay(wednesdayHoliday, holidays);
      expect(result.toISOString().split('T')[0]).toBe('2025-01-02'); // Thursday
    });
  });
});
