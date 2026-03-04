/**
 * @hmc/export-service - CSV and JSON export utilities
 *
 * Provides:
 * - CSV generation with proper escaping (commas, quotes, newlines)
 * - JSON export with metadata envelope
 * - Generic data export (any array of records)
 * - Streaming-friendly output
 */

import { createLogger } from '@hmc/logger';

const logger = createLogger('export-service');

// ── CSV Helpers ─────────────────────────────────────────────────

export function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCSV(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(escapeCSV).join(',');
  const dataLines = rows.map(row => row.map(escapeCSV).join(','));
  return [headerLine, ...dataLines].join('\n');
}

/**
 * Export an array of records as CSV.
 * Automatically uses object keys as headers if none provided.
 */
export function exportToCSV<T extends Record<string, unknown>>(
  records: T[],
  options?: {
    headers?: string[];
    columns?: (keyof T)[];
    label?: string;
  }
): string {
  if (records.length === 0) return '';

  const columns = options?.columns || (Object.keys(records[0]) as (keyof T)[]);
  const headers = options?.headers || columns.map(String);

  const rows = records.map(record =>
    columns.map(col => {
      const value = record[col];
      if (value instanceof Date) return value.toISOString();
      return value;
    })
  );

  if (options?.label) {
    logger.info(`${options.label} exported as CSV`, { rowCount: rows.length });
  }

  return buildCSV(headers, rows);
}

// ── JSON Export ──────────────────────────────────────────────────

export interface JsonExportEnvelope<T> {
  exportedAt: string;
  totalRecords: number;
  metadata?: Record<string, unknown>;
  records: T[];
}

/**
 * Export an array of records as JSON with metadata envelope.
 */
export function exportToJSON<T>(
  records: T[],
  options?: {
    metadata?: Record<string, unknown>;
    label?: string;
    dateFields?: string[];
  }
): string {
  const processed = options?.dateFields
    ? records.map(record => {
        const r = { ...record } as Record<string, unknown>;
        for (const field of options.dateFields!) {
          if (r[field] instanceof Date) {
            r[field] = (r[field] as Date).toISOString();
          }
        }
        return r as T;
      })
    : records;

  const envelope: JsonExportEnvelope<T> = {
    exportedAt: new Date().toISOString(),
    totalRecords: processed.length,
    metadata: options?.metadata,
    records: processed,
  };

  if (options?.label) {
    logger.info(`${options.label} exported as JSON`, { rowCount: records.length });
  }

  return JSON.stringify(envelope, null, 2);
}

// ── Streaming CSV ───────────────────────────────────────────────

/**
 * Generate CSV rows as an async iterator for streaming large datasets.
 */
export async function* streamCSV<T extends Record<string, unknown>>(
  records: AsyncIterable<T> | T[],
  options?: {
    headers?: string[];
    columns?: (keyof T)[];
  }
): AsyncGenerator<string> {
  let headerEmitted = false;
  let columns: (keyof T)[] | undefined = options?.columns;

  for await (const record of records) {
    if (!headerEmitted) {
      columns = columns || (Object.keys(record) as (keyof T)[]);
      const headers = options?.headers || columns.map(String);
      yield headers.map(escapeCSV).join(',') + '\n';
      headerEmitted = true;
    }

    const row = columns!.map(col => {
      const value = record[col];
      if (value instanceof Date) return value.toISOString();
      return value;
    });

    yield row.map(escapeCSV).join(',') + '\n';
  }
}
