import { createLogger } from '@hmc/logger';

const logger = createLogger('migration-safety');

const DESTRUCTIVE_PATTERNS = [
  { pattern: /DROP\s+TABLE/gi, label: 'DROP TABLE' },
  { pattern: /DROP\s+COLUMN/gi, label: 'DROP COLUMN' },
  { pattern: /TRUNCATE\s+/gi, label: 'TRUNCATE' },
  { pattern: /DELETE\s+FROM\s+\w+\s*(?:;|\s*$)/gim, label: 'DELETE without WHERE' },
  { pattern: /ALTER\s+TABLE\s+\w+\s+DROP\s+/gi, label: 'ALTER TABLE DROP' },
  { pattern: /DROP\s+INDEX\s+(?!IF\s+EXISTS)/gi, label: 'DROP INDEX (without IF EXISTS)' },
  { pattern: /DROP\s+SCHEMA/gi, label: 'DROP SCHEMA' },
  { pattern: /DROP\s+DATABASE/gi, label: 'DROP DATABASE' },
];

export function checkForDestructiveSQL(sql: string): string[] {
  const violations: string[] = [];
  for (const { pattern, label } of DESTRUCTIVE_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(sql);
    if (match) {
      violations.push(`${label}: "${match[0].trim()}" found at position ${match.index}`);
    }
  }
  return violations;
}

export async function safeExecuteSQL(
  pool: { query: (sql: string) => Promise<unknown> },
  sql: string,
  context: string = 'migration'
): Promise<void> {
  const violations = checkForDestructiveSQL(sql);

  if (violations.length > 0) {
    const message = `BLOCKED: Destructive SQL detected in ${context}:\n` +
      violations.map(v => `  - ${v}`).join('\n') +
      '\n\nThis migration was NOT executed. Review the SQL and run manually if intended.';
    logger.error(message);
    throw new Error(message);
  }

  await pool.query(sql);
}

export async function validateMigrationFile(filePath: string): Promise<{
  safe: boolean;
  violations: string[];
}> {
  const fs = await import('fs/promises');
  const sql = await fs.readFile(filePath, 'utf-8');
  const violations = checkForDestructiveSQL(sql);

  if (violations.length > 0) {
    logger.error(`Migration file ${filePath} contains destructive operations:`, {
      violations,
    });
  }

  return { safe: violations.length === 0, violations };
}
