import { Request, Response, NextFunction, RequestHandler } from 'express';
import { createLogger } from '@hmc/logger';
import type { AuthenticatedUser, PlatformRole, TenantRole } from '@hmc/types';

const logger = createLogger('auth-middleware');

const IMPERSONATE_TENANT_HEADER = 'x-impersonate-tenant';

/** DB adapter interface - apps provide their own implementation */
export interface AuthDbAdapter {
  findUserById(id: string): Promise<{
    id: string;
    email: string;
    displayName: string | null;
    role: string;
    isActive: boolean;
    tenantId?: string | null;
  } | null>;

  findTenantMembership?(userId: string, tenantId: string): Promise<{
    role: string;
    isActive: boolean;
  } | null>;

  findFirstActiveTenantForUser?(userId: string): Promise<{
    tenantId: string;
    role: string;
  } | null>;

  findFirstActiveTenant?(): Promise<{
    id: string;
  } | null>;

  logAudit?(entry: {
    tenantId: string;
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    newValues: Record<string, unknown>;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<void>;
}

let dbAdapter: AuthDbAdapter | null = null;

/** Initialize auth middleware with your app's database adapter */
export function initAuth(adapter: AuthDbAdapter): void {
  dbAdapter = adapter;
}

function getAdapter(): AuthDbAdapter {
  if (!dbAdapter) {
    throw new Error('Auth not initialized. Call initAuth(adapter) before using auth middleware.');
  }
  return dbAdapter;
}

function getSuperadminImpersonationTenant(req: Request): string | null {
  const header = req.headers[IMPERSONATE_TENANT_HEADER];
  return typeof header === 'string' && header.length > 0 ? header : null;
}

async function logImpersonation(userId: string, tenantId: string, action: string, req: Request): Promise<void> {
  try {
    logger.warn('Superadmin tenant impersonation', {
      superadminId: userId,
      tenantId,
      action,
      method: req.method,
      path: req.path,
      ip: req.ip,
    });

    await getAdapter().logAudit?.({
      tenantId,
      userId,
      action: 'superadmin_impersonation',
      resourceType: 'tenant',
      resourceId: tenantId,
      newValues: { path: req.path, method: req.method, action },
      ipAddress: req.ip || null,
      userAgent: req.headers['user-agent'] || null,
    });
  } catch (error) {
    logger.error('Failed to log impersonation', { error });
  }
}

async function loadUserOrFail(req: Request, res: Response): Promise<{
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  tenantId?: string | null;
} | null> {
  const sessionId = req.session?.userId;
  if (!sessionId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  const user = await getAdapter().findUserById(sessionId);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  if (!user.isActive) {
    res.status(401).json({ error: 'Account is disabled' });
    return null;
  }
  return user;
}

/**
 * Base authentication - validates user session.
 * Does NOT require tenant context. Resolves tenant from subdomain, user record, or first membership.
 */
export const requireAuth: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await loadUserOrFail(req, res);
    if (!user) return;
    const adapter = getAdapter();

    const authUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      platformRole: user.role as PlatformRole,
      role: user.role as PlatformRole,
    };

    if (req.tenant) {
      // Subdomain-based tenant context
      const membership = await adapter.findTenantMembership?.(user.id, req.tenant.id);
      if (membership?.isActive) {
        authUser.tenantId = req.tenant.id;
        authUser.tenantRole = membership.role as TenantRole;
      } else if (user.role === 'superadmin') {
        const impersonateTenantId = getSuperadminImpersonationTenant(req);
        if (impersonateTenantId === req.tenant.id) {
          authUser.tenantId = req.tenant.id;
          authUser.tenantRole = 'admin';
          authUser.isImpersonating = true;
          authUser.impersonatedTenantId = req.tenant.id;
          await logImpersonation(user.id, req.tenant.id, 'tenant_access', req);
        }
      }
    } else {
      // No subdomain - resolve from user record or first membership
      if (user.tenantId) {
        const membership = await adapter.findTenantMembership?.(user.id, user.tenantId);
        authUser.tenantId = user.tenantId;
        authUser.tenantRole = membership ? (membership.role as TenantRole) : 'member';
      } else {
        const membership = await adapter.findFirstActiveTenantForUser?.(user.id);
        if (membership) {
          authUser.tenantId = membership.tenantId;
          authUser.tenantRole = membership.role as TenantRole;
        } else {
          const fallbackTenant = await adapter.findFirstActiveTenant?.();
          if (fallbackTenant) {
            authUser.tenantId = fallbackTenant.id;
            authUser.tenantRole = 'member';
          }
        }
      }
    }

    req.user = authUser;
    next();
  } catch (error) {
    logger.error('Auth middleware error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Tenant-aware authentication - requires user to be a member of the current tenant.
 */
export const requireTenantAuth: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await loadUserOrFail(req, res);
    if (!user) return;

    if (!req.tenant) {
      res.status(400).json({ error: 'Tenant context required' });
      return;
    }

    const adapter = getAdapter();
    const membership = await adapter.findTenantMembership?.(user.id, req.tenant.id);
    const isPlatformSuperadmin = user.role === 'superadmin';
    const impersonateTenantId = getSuperadminImpersonationTenant(req);
    const isImpersonating = isPlatformSuperadmin && impersonateTenantId === req.tenant.id;

    if (!membership?.isActive && !isImpersonating) {
      if (isPlatformSuperadmin) {
        res.status(403).json({
          error: 'Superadmin impersonation required',
          message: 'Set X-Impersonate-Tenant header to access tenant data',
        });
      } else {
        res.status(403).json({ error: 'Access denied to this organization' });
      }
      return;
    }

    if (isImpersonating) {
      await logImpersonation(user.id, req.tenant.id, 'tenant_auth', req);
    }

    req.user = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      platformRole: user.role as PlatformRole,
      role: user.role as PlatformRole,
      tenantId: req.tenant.id,
      tenantRole: isImpersonating ? 'admin' : (membership?.role as TenantRole),
      isImpersonating,
      impersonatedTenantId: isImpersonating ? req.tenant.id : undefined,
    };

    next();
  } catch (error) {
    logger.error('Auth middleware error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Require tenant admin role (owner or admin within the tenant).
 */
export const requireTenantAdmin: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await loadUserOrFail(req, res);
    if (!user) return;

    if (!req.tenant) {
      res.status(400).json({ error: 'Tenant context required' });
      return;
    }

    const adapter = getAdapter();
    const membership = await adapter.findTenantMembership?.(user.id, req.tenant.id);
    const isPlatformSuperadmin = user.role === 'superadmin';
    const impersonateTenantId = getSuperadminImpersonationTenant(req);
    const isImpersonating = isPlatformSuperadmin && impersonateTenantId === req.tenant.id;

    if (isImpersonating) {
      await logImpersonation(user.id, req.tenant.id, 'tenant_admin', req);
      req.user = {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        platformRole: 'superadmin',
        role: 'superadmin',
        tenantId: req.tenant.id,
        tenantRole: 'admin',
        isImpersonating: true,
        impersonatedTenantId: req.tenant.id,
      };
      return next();
    }

    if (!membership?.isActive) {
      if (isPlatformSuperadmin) {
        res.status(403).json({
          error: 'Superadmin impersonation required',
          message: 'Set X-Impersonate-Tenant header to access tenant data',
        });
      } else {
        res.status(403).json({ error: 'Access denied to this organization' });
      }
      return;
    }

    if (membership.role !== 'owner' && membership.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      platformRole: user.role as PlatformRole,
      role: user.role as PlatformRole,
      tenantId: req.tenant.id,
      tenantRole: membership.role as TenantRole,
    };

    next();
  } catch (error) {
    logger.error('Auth middleware error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Require tenant owner role.
 */
export const requireTenantOwner: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await loadUserOrFail(req, res);
    if (!user) return;

    if (!req.tenant) {
      res.status(400).json({ error: 'Tenant context required' });
      return;
    }

    const adapter = getAdapter();
    const membership = await adapter.findTenantMembership?.(user.id, req.tenant.id);
    const isPlatformSuperadmin = user.role === 'superadmin';
    const impersonateTenantId = getSuperadminImpersonationTenant(req);
    const isImpersonating = isPlatformSuperadmin && impersonateTenantId === req.tenant.id;

    if (isImpersonating) {
      await logImpersonation(user.id, req.tenant.id, 'tenant_owner', req);
      req.user = {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        platformRole: 'superadmin',
        role: 'superadmin',
        tenantId: req.tenant.id,
        tenantRole: 'owner',
        isImpersonating: true,
        impersonatedTenantId: req.tenant.id,
      };
      return next();
    }

    if (!membership?.isActive || membership.role !== 'owner') {
      if (isPlatformSuperadmin) {
        res.status(403).json({
          error: 'Superadmin impersonation required',
          message: 'Set X-Impersonate-Tenant header to access tenant data',
        });
      } else {
        res.status(403).json({ error: 'Owner access required' });
      }
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      platformRole: user.role as PlatformRole,
      role: user.role as PlatformRole,
      tenantId: req.tenant.id,
      tenantRole: 'owner',
    };

    next();
  } catch (error) {
    logger.error('Auth middleware error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Platform admin - requires admin or superadmin platform role.
 */
export const requireAdmin: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await loadUserOrFail(req, res);
    if (!user) return;

    if (user.role !== 'admin' && user.role !== 'superadmin') {
      res.status(403).json({ error: 'Forbidden: Admin access required' });
      return;
    }

    const authUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      platformRole: user.role as PlatformRole,
      role: user.role as PlatformRole,
    };

    if (req.tenant && user.role === 'superadmin') {
      const impersonateTenantId = getSuperadminImpersonationTenant(req);
      if (impersonateTenantId === req.tenant.id) {
        await logImpersonation(user.id, req.tenant.id, 'admin_access', req);
        authUser.tenantId = req.tenant.id;
        authUser.tenantRole = 'admin';
        authUser.isImpersonating = true;
        authUser.impersonatedTenantId = req.tenant.id;
      }
    }

    req.user = authUser;
    next();
  } catch (error) {
    logger.error('Auth middleware error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Platform superadmin only.
 */
export const requireSuperAdmin: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await loadUserOrFail(req, res);
    if (!user) return;

    if (user.role !== 'superadmin') {
      res.status(403).json({ error: 'Forbidden: Platform Super Admin access required' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      platformRole: 'superadmin',
      role: 'superadmin',
    };

    next();
  } catch (error) {
    logger.error('Auth middleware error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Validate user can only access their own tenant's data.
 * Use as additional middleware on routes with tenantId in params.
 */
export const validateTenantAccess: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const paramTenantId = req.params.tenantId || req.body?.tenantId;
  if (!paramTenantId) return next();
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.platformRole === 'superadmin') return next();
  if (req.user.tenantId !== paramTenantId) {
    return res.status(403).json({ error: 'Cross-tenant access denied' });
  }
  next();
};
