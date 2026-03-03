import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

export interface DatabaseConfig {
  connectionString: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export interface DatabaseInstance<TSchema extends Record<string, unknown> = Record<string, unknown>> {
  db: NodePgDatabase<TSchema>;
  pool: pg.Pool;
  close: () => Promise<void>;
}

export function createDatabase<TSchema extends Record<string, unknown>>(
  config: DatabaseConfig,
  schema: TSchema
): DatabaseInstance<TSchema> {
  const pool = new pg.Pool({
    connectionString: config.connectionString,
    max: config.max ?? 20,
    idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
    connectionTimeoutMillis: config.connectionTimeoutMillis ?? 2000,
  });

  const db = drizzle(pool, { schema });

  return {
    db,
    pool,
    close: () => pool.end(),
  };
}
