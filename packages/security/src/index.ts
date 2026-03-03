/**
 * @hmc/security - Security middleware for Express apps
 *
 * Provides:
 * - CSRF protection (double-submit cookie pattern)
 * - Rate limiting (auth, API, query tiers)
 * - AES-256-GCM encryption/decryption for stored secrets
 * - Migration safety guard (blocks DROP TABLE/COLUMN)
 */

export { csrfProtection } from './csrf.js';
export { authRateLimit, apiRateLimit, queryRateLimit, createRateLimit } from './rateLimit.js';
export { encrypt, decrypt } from './encryption.js';
export { checkForDestructiveSQL, safeExecuteSQL, validateMigrationFile } from './migrationSafety.js';
