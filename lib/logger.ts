/**
 * Structured logging utility (AUDIT-010, AUDIT-013, AUDIT-028, AUDIT-033).
 *
 * Lightweight wrapper around console that:
 * - Outputs JSON in production, readable format in development
 * - Supports log levels: debug, info, warn, error
 * - Accepts structured context objects
 * - Auto-redacts PII (email addresses) from log messages and context values
 * - Supports correlation IDs for request tracing
 *
 * Usage:
 *   import { logger, createLogger } from '@/lib/logger';
 *
 *   logger.info('Server started', { port: 3000 });
 *
 *   const log = createLogger({ orgId: 'xxx', correlationId: 'yyy' });
 *   log.info('Processing client', { clientId: '123' });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LogContext = Record<string, any>;

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Minimum log level: debug in dev, info in prod
const MIN_LEVEL: LogLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Redact PII from a string value.
 * Replaces email addresses with [REDACTED_EMAIL].
 */
export function redactPII(value: string): string {
  // Redact email addresses (anything with @ that looks like an email)
  const redacted = value.replace(
    /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    '[REDACTED_EMAIL]'
  );
  return redacted;
}

/**
 * Recursively redact PII from context values.
 * Only processes string values; other types pass through unchanged.
 */
function redactContext(context: LogContext): LogContext {
  const redacted: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === 'string') {
      redacted[key] = redactPII(value);
    } else if (value instanceof Error) {
      redacted[key] = redactPII(value.message);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      redacted[key] = redactContext(value as LogContext);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/**
 * Format and emit a log entry.
 */
function emit(level: LogLevel, message: string, context: LogContext): void {
  if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[MIN_LEVEL]) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: redactPII(message),
    ...redactContext(context),
  };

  if (IS_PRODUCTION) {
    // JSON output for production (structured log ingestion)
    /* eslint-disable no-console */
    const consoleMethod = level === 'error' ? console.error
      : level === 'warn' ? console.warn
      : console.log;
    consoleMethod(JSON.stringify(entry));
    /* eslint-enable no-console */
  } else {
    // Readable format for development
    const { timestamp, level: lvl, message: msg, ...rest } = entry;
    const contextStr = Object.keys(rest).length > 0
      ? ' ' + JSON.stringify(rest)
      : '';
    const prefix = `[${timestamp}] ${lvl.toUpperCase()}`;

    /* eslint-disable no-console */
    if (level === 'error') {
      console.error(`${prefix}: ${msg}${contextStr}`);
    } else if (level === 'warn') {
      console.warn(`${prefix}: ${msg}${contextStr}`);
    } else {
      console.log(`${prefix}: ${msg}${contextStr}`);
    }
    /* eslint-enable no-console */
  }
}

/**
 * Logger instance with standard log methods.
 */
export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

function createLoggerMethods(baseContext: LogContext): Logger {
  return {
    debug(message: string, context: LogContext = {}) {
      emit('debug', message, { ...baseContext, ...context });
    },
    info(message: string, context: LogContext = {}) {
      emit('info', message, { ...baseContext, ...context });
    },
    warn(message: string, context: LogContext = {}) {
      emit('warn', message, { ...baseContext, ...context });
    },
    error(message: string, context: LogContext = {}) {
      emit('error', message, { ...baseContext, ...context });
    },
  };
}

/**
 * Default logger instance (no preset context).
 */
export const logger = createLoggerMethods({});

/**
 * Create a logger with preset context (orgId, correlationId, etc.).
 * All log calls will include this context automatically.
 *
 * @param context - Base context to include in every log entry
 * @returns Logger instance with preset context
 */
export function createLogger(context: LogContext): Logger {
  return createLoggerMethods(context);
}
