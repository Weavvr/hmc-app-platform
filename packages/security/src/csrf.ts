import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { createLogger } from '@hmc/logger';

const logger = createLogger('csrf');

const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_LENGTH = 32;

const DEFAULT_EXEMPT_PATHS = ['/api/auth/login', '/api/auth/entra/', '/api/scim/', '/health'];

export interface CsrfOptions {
  exemptPaths?: string[];
  cookieName?: string;
  headerName?: string;
}

export function csrfProtection(options: CsrfOptions = {}) {
  const exemptPaths = options.exemptPaths ?? DEFAULT_EXEMPT_PATHS;
  const cookieName = options.cookieName ?? CSRF_COOKIE_NAME;
  const headerName = options.headerName ?? CSRF_HEADER_NAME;

  function isExempt(req: Request): boolean {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    const path = req.path;
    for (const exempt of exemptPaths) {
      if (path.startsWith(exempt)) return true;
    }
    if (req.headers.authorization?.startsWith('Bearer ')) return true;
    return false;
  }

  return (req: Request, res: Response, next: NextFunction) => {
    let token = req.cookies?.[cookieName];

    if (!token) {
      token = randomBytes(TOKEN_LENGTH).toString('hex');
      res.cookie(cookieName, token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000,
      });
    }

    if (isExempt(req)) {
      return next();
    }

    const headerToken = req.headers[headerName] as string | undefined;

    if (!headerToken || headerToken !== token) {
      logger.warn('CSRF token validation failed', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      return res.status(403).json({
        error: 'CSRF token validation failed',
        code: 'CSRF_INVALID',
      });
    }

    next();
  };
}
