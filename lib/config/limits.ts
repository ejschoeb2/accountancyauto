/**
 * Application limits and thresholds.
 * Each constant documents WHY it exists to aid future maintenance.
 */

/** Max CSV file size in bytes — prevents memory exhaustion during parsing */
export const MAX_CSV_FILE_SIZE = 1 * 1024 * 1024; // 1MB

/** Vercel serverless function timeout for cron jobs */
export const CRON_MAX_DURATION = 300; // 5 minutes (Vercel Pro plan limit)

/** Default page size for paginated API responses */
export const DEFAULT_PAGE_SIZE = 500;

/** Max reference table rows to fetch (defensive limit) */
export const MAX_REFERENCE_TABLE_ROWS = 1000;
