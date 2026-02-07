import { isWeekend, addDays, format } from 'date-fns';
import { UTCDate } from '@date-fns/utc';

/**
 * Check if a given date is a working day (not weekend, not bank holiday)
 * @param date - The date to check
 * @param holidays - Set of bank holiday date strings in YYYY-MM-DD format
 * @returns true if working day, false if weekend or bank holiday
 */
export function isWorkingDay(date: Date, holidays: Set<string>): boolean {
  // Check if weekend
  if (isWeekend(date)) {
    return false;
  }

  // Check if bank holiday
  const dateStr = format(date, 'yyyy-MM-dd');
  if (holidays.has(dateStr)) {
    return false;
  }

  return true;
}

/**
 * Get the next working day from a given date
 * If the date is already a working day, returns the same date
 * Otherwise, advances to the next working day
 * @param date - The starting date
 * @param holidays - Set of bank holiday date strings in YYYY-MM-DD format
 * @returns The next working day
 */
export function getNextWorkingDay(date: Date, holidays: Set<string>): Date {
  let currentDate = new UTCDate(date);

  // Keep advancing until we find a working day
  while (!isWorkingDay(currentDate, holidays)) {
    currentDate = new UTCDate(addDays(currentDate, 1));
  }

  return currentDate;
}
