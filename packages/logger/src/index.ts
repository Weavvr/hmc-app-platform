/**
 * @hmc/logger - Structured logging with correlation IDs
 *
 * Provides consistent logging across all HMC packages:
 * - Correlation IDs for request tracing via AsyncLocalStorage
 * - JSON structured output in production
 * - Human-readable output in development
 * - Scoped loggers per service/module
 */

import { AsyncLocalStorage } from 'async_hooks';

const correlationIdStorage = new AsyncLocalStorage<string>();

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  service?: string;
  userId?: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  [key: string]: unknown;
}

const isProduction = process.env.NODE_ENV === 'production';

export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function getCorrelationId(): string | undefined {
  return correlationIdStorage.getStore();
}

export function withCorrelationId<T>(correlationId: string, fn: () => T): T {
  return correlationIdStorage.run(correlationId, fn);
}

function formatLogEntry(entry: LogEntry): string {
  if (isProduction) {
    return JSON.stringify(entry);
  }

  const { timestamp, level, message, correlationId, service, error, ...rest } = entry;
  const prefix = correlationId ? `[${correlationId.substring(0, 8)}]` : '';
  const servicePrefix = service ? `[${service}]` : '';
  const levelStr = level.toUpperCase().padEnd(5);

  let output = `${timestamp} ${levelStr} ${prefix}${servicePrefix} ${message}`;

  const extraKeys = Object.keys(rest).filter(k => k !== 'userId');
  if (extraKeys.length > 0 || rest.userId) {
    const context: Record<string, unknown> = {};
    if (rest.userId) context.userId = rest.userId;
    extraKeys.forEach(k => context[k] = rest[k]);
    output += ` ${JSON.stringify(context)}`;
  }

  if (error) {
    output += `\n  Error: ${error.name}: ${error.message}`;
    if (error.stack && !isProduction) {
      output += `\n  ${error.stack.split('\n').slice(1, 4).join('\n  ')}`;
    }
  }

  return output;
}

function log(level: LogLevel, message: string, context: Omit<LogEntry, 'timestamp' | 'level' | 'message'> = {}): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    correlationId: getCorrelationId(),
    ...context,
  };

  const formatted = formatLogEntry(entry);

  switch (level) {
    case 'debug':
      if (!isProduction) console.debug(formatted);
      break;
    case 'info':
      console.info(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
      console.error(formatted);
      break;
  }
}

export interface Logger {
  debug: (message: string, context?: Record<string, unknown>) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, err?: Error | unknown, context?: Record<string, unknown>) => void;
  timed: (message: string, startTime: number, context?: Record<string, unknown>) => void;
}

export function createLogger(service: string): Logger {
  return {
    debug: (message: string, context?: Record<string, unknown>) =>
      log('debug', message, { service, ...context }),

    info: (message: string, context?: Record<string, unknown>) =>
      log('info', message, { service, ...context }),

    warn: (message: string, context?: Record<string, unknown>) =>
      log('warn', message, { service, ...context }),

    error: (message: string, err?: Error | unknown, context?: Record<string, unknown>) => {
      const errorInfo = err instanceof Error
        ? { name: err.name, message: err.message, stack: err.stack }
        : err
          ? { name: 'Error', message: String(err) }
          : undefined;

      log('error', message, { service, error: errorInfo, ...context });
    },

    timed: (message: string, startTime: number, context?: Record<string, unknown>) => {
      const duration = Date.now() - startTime;
      log('info', message, { service, duration, ...context });
    },
  };
}

export const logger = createLogger('app');
