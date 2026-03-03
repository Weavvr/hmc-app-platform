/**
 * @hmc/session - PostgreSQL-backed session management with connect-pg-simple
 *
 * Provides:
 * - createSessionMiddleware() factory for Express session with PG store
 * - Sensible defaults: 24h cookies, httpOnly, lax sameSite, auto table creation
 */

import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import type { Pool } from 'pg';

export interface SessionConfig {
  /** PostgreSQL pool for session storage */
  pool: Pool;
  /** Session secret (min 32 chars) */
  secret: string;
  /** Cookie max age in ms (default: 24 hours) */
  maxAge?: number;
  /** Secure cookies (default: true in production) */
  secure?: boolean;
  /** SameSite policy (default: 'lax' - required for SSO redirects) */
  sameSite?: 'strict' | 'lax' | 'none';
  /** Session table name (default: 'session') */
  tableName?: string;
  /** Auto-create session table if missing (default: true) */
  createTableIfMissing?: boolean;
}

export function createSessionMiddleware(config: SessionConfig) {
  const PgSession = connectPgSimple(session);
  const isProduction = process.env.NODE_ENV === 'production';

  return session({
    store: new PgSession({
      pool: config.pool,
      tableName: config.tableName ?? 'session',
      createTableIfMissing: config.createTableIfMissing ?? true,
    }),
    secret: config.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.secure ?? isProduction,
      httpOnly: true,
      maxAge: config.maxAge ?? 24 * 60 * 60 * 1000,
      sameSite: config.sameSite ?? 'lax',
    },
  });
}
