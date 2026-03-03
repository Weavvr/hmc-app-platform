/**
 * @hmc/auth - Authentication and authorization middleware
 *
 * Provides:
 * - initAuth() to wire up your app's database adapter
 * - requireAuth, requireTenantAuth, requireTenantAdmin, requireTenantOwner
 * - requireAdmin, requireSuperAdmin (platform-level)
 * - validateTenantAccess (param-level tenant guard)
 * - Superadmin impersonation with audit logging
 */

export {
  initAuth,
  requireAuth,
  requireTenantAuth,
  requireTenantAdmin,
  requireTenantOwner,
  requireAdmin,
  requireSuperAdmin,
  validateTenantAccess,
  type AuthDbAdapter,
} from './middleware.js';
