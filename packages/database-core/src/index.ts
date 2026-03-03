/**
 * @hmc/database-core - Drizzle ORM database setup and shared schema patterns
 *
 * Provides:
 * - createDatabase() factory for PostgreSQL + Drizzle ORM connections
 * - Shared schema patterns (users, sessions, audit_logs)
 * - createEnvConfig() for Zod-validated environment variables
 * - Pool configuration with sensible defaults
 */

export { createDatabase, type DatabaseInstance } from './db.js';
export { createEnvConfig } from './env.js';
export { baseSchemas } from './schemas.js';
