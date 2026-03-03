import { pgTable, text, timestamp, boolean, uuid } from 'drizzle-orm/pg-core';

/**
 * Base schema patterns shared across all HMC applications.
 * Apps extend these with their own domain-specific tables.
 */
export const baseSchemas = {
  /**
   * Core users table - present in every app
   */
  users: pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'),
    displayName: text('display_name'),
    role: text('role').notNull().default('user'),
    isActive: boolean('is_active').notNull().default(true),
    tenantId: text('tenant_id'),
    entraId: text('entra_id'),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }),

  /**
   * Audit logs - track all data changes
   */
  auditLogs: pgTable('audit_logs', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    oldValues: text('old_values'),
    newValues: text('new_values'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  }),
};
