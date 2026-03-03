/**
 * @hmc/types - Shared TypeScript types and interfaces across all HMC packages
 */

// ── Platform Roles ──────────────────────────────────────────────
export type PlatformRole = 'superadmin' | 'admin' | 'user';
export type TenantRole = 'owner' | 'admin' | 'member';

// ── Authenticated User ──────────────────────────────────────────
export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string | null;
  platformRole: PlatformRole;
  /** Legacy alias for platformRole */
  role: PlatformRole;
  tenantId?: string;
  tenantRole?: TenantRole;
  isImpersonating?: boolean;
  impersonatedTenantId?: string;
  hasM365Access?: boolean;
}

// ── Tenant Context ──────────────────────────────────────────────
export interface TenantContext {
  id: string;
  name: string;
  slug: string;
  subdomain?: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
}

// ── API Response Envelope ───────────────────────────────────────
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    [key: string]: unknown;
  };
}

// ── Express Augmentations ───────────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      userId?: string;
      tenant?: TenantContext;
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    tenantId?: string;
    selectedTenantId?: string;
    oidcState?: string;
    oidcNonce?: string;
    oidcRedirectUri?: string;
    m365ConsentState?: string;
    m365ConsentRedirectUri?: string;
  }
}
