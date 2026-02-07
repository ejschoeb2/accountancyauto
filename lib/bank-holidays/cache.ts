import { format } from 'date-fns';

export interface BankHoliday {
  title: string;
  date: string;
  notes: string;
  bunting: boolean;
}

interface BankHolidayAPIResponse {
  'england-and-wales': {
    division: string;
    events: BankHoliday[];
  };
  scotland: {
    division: string;
    events: BankHoliday[];
  };
  'northern-ireland': {
    division: string;
    events: BankHoliday[];
  };
}

// In-memory cache with 7-day TTL
let cachedHolidays: Set<string> | null = null;
let cacheTimestamp: number | null = null;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Fetch UK bank holidays from GOV.UK API
 * Returns England and Wales bank holiday events
 */
export async function fetchUKBankHolidays(): Promise<BankHoliday[]> {
  try {
    const response = await fetch('https://www.gov.uk/bank-holidays.json');
    if (!response.ok) {
      throw new Error(`GOV.UK API returned ${response.status}`);
    }

    const data: BankHolidayAPIResponse = await response.json();
    return data['england-and-wales'].events;
  } catch (error) {
    console.error('Failed to fetch bank holidays from GOV.UK:', error);

    // TODO: Fall back to Supabase bank_holidays_cache table
    // For now, return empty array and log error
    return [];
  }
}

/**
 * Get UK bank holidays as a Set of date strings (YYYY-MM-DD format)
 * Uses in-memory cache with 7-day TTL
 * Falls back to Supabase cache if API fails
 */
export async function getUKBankHolidaySet(): Promise<Set<string>> {
  // Check if cache is valid
  const now = Date.now();
  if (cachedHolidays && cacheTimestamp && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedHolidays;
  }

  // Fetch fresh data
  try {
    const holidays = await fetchUKBankHolidays();
    const holidaySet = new Set(holidays.map((h) => h.date));

    // Update cache
    cachedHolidays = holidaySet;
    cacheTimestamp = now;

    // TODO: Store in Supabase bank_holidays_cache table for persistence

    return holidaySet;
  } catch (error) {
    console.error('Failed to get bank holidays:', error);

    // Return cached data if available, even if expired
    if (cachedHolidays) {
      console.warn('Using expired bank holiday cache');
      return cachedHolidays;
    }

    // TODO: Try to load from Supabase bank_holidays_cache table

    // Last resort: return empty set
    console.error('No bank holiday data available, using empty set');
    return new Set();
  }
}
