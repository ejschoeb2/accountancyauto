/**
 * Simple in-memory circuit breaker for Postmark API calls.
 *
 * Resets on serverless cold start — acceptable for this use case since the
 * circuit breaker's purpose is to shed load during an active outage, not to
 * persist state across restarts.
 *
 * States:
 *   CLOSED    — Normal operation. All calls go through.
 *   OPEN      — Too many consecutive failures. Calls are rejected immediately
 *               without hitting Postmark.
 *   HALF_OPEN — Recovery probe. One call is allowed through; success closes
 *               the circuit, failure re-opens it.
 */

const FAILURE_THRESHOLD = 5;    // Consecutive failures before opening the circuit
const RESET_TIMEOUT_MS = 60000; // 1 minute before moving from OPEN → HALF_OPEN
export const BACKOFF_BASE_MS = 1000; // 1 second base for exponential backoff

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

// Module-level state — shared across all calls within a single serverless instance
let state: CircuitState = 'CLOSED';
let consecutiveFailures = 0;
let openedAt: number | null = null;

/**
 * Returns the current circuit breaker state (for observability / logging).
 */
export function getCircuitState(): CircuitState {
  return state;
}

/**
 * Returns the current consecutive failure count (for observability / logging).
 */
export function getConsecutiveFailures(): number {
  return consecutiveFailures;
}

/**
 * Reset the circuit breaker to CLOSED state.
 * Exported primarily for testing; production code should not call this directly.
 */
export function resetCircuit(): void {
  state = 'CLOSED';
  consecutiveFailures = 0;
  openedAt = null;
}

/**
 * Wrap a Postmark API call with circuit breaker logic.
 *
 * - CLOSED: execute fn normally; track failures / successes.
 * - OPEN:   if timeout has not elapsed, reject immediately with CircuitOpenError.
 *           if timeout has elapsed, transition to HALF_OPEN and allow one probe.
 * - HALF_OPEN: allow one call through; close on success, re-open on failure.
 *
 * @param fn   Async factory that performs the Postmark call.
 * @returns    The resolved value of fn().
 * @throws     CircuitOpenError if the circuit is OPEN and the timeout has not elapsed.
 * @throws     The original error from fn() if the call fails.
 */
export async function withCircuitBreaker<T>(fn: () => Promise<T>): Promise<T> {
  // Evaluate whether an OPEN circuit should transition to HALF_OPEN
  if (state === 'OPEN') {
    const elapsed = Date.now() - (openedAt ?? 0);
    if (elapsed < RESET_TIMEOUT_MS) {
      throw new CircuitOpenError(
        `Postmark circuit breaker is OPEN — rejecting call fast. ` +
        `Will probe again in ${Math.ceil((RESET_TIMEOUT_MS - elapsed) / 1000)}s.`
      );
    }
    // Timeout elapsed — allow a single probe
    state = 'HALF_OPEN';
  }

  try {
    const result = await fn();
    // Success: close the circuit (reset failure count)
    onSuccess();
    return result;
  } catch (error) {
    // Failure: record and potentially open the circuit
    onFailure();
    throw error;
  }
}

/**
 * Calculate the exponential backoff delay for a given attempt number (0-indexed).
 * Attempt 0 → 0 ms (no delay before the first try)
 * Attempt 1 → 1 000 ms
 * Attempt 2 → 2 000 ms
 * Attempt 3 → 4 000 ms
 * Attempt 4 → 8 000 ms
 * ...capped at 30 seconds.
 */
export function backoffDelay(attemptNumber: number): number {
  if (attemptNumber <= 0) return 0;
  return Math.min(BACKOFF_BASE_MS * Math.pow(2, attemptNumber - 1), 30_000);
}

/**
 * Sleep for the calculated backoff duration.
 * No-op when attemptNumber is 0 (first attempt).
 */
export async function sleepBackoff(attemptNumber: number): Promise<void> {
  const delay = backoffDelay(attemptNumber);
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function onSuccess(): void {
  consecutiveFailures = 0;
  state = 'CLOSED';
  openedAt = null;
}

function onFailure(): void {
  consecutiveFailures++;
  if (state === 'HALF_OPEN' || consecutiveFailures >= FAILURE_THRESHOLD) {
    state = 'OPEN';
    openedAt = Date.now();
  }
}

// ── Error type ────────────────────────────────────────────────────────────────

export class CircuitOpenError extends Error {
  readonly code = 'CIRCUIT_OPEN' as const;
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}
