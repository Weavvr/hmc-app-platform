import rateLimit, { type Options } from 'express-rate-limit';
import { createLogger } from '@hmc/logger';

const logger = createLogger('rateLimit');

export function createRateLimit(options: Partial<Options> & { name?: string }) {
  const name = options.name ?? 'custom';
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, _next, opts) => {
      logger.warn(`${name} rate limit exceeded`, {
        ip: req.ip,
        path: req.path,
      });
      res.status(429).json(opts.message);
    },
    ...options,
  });
}

export const authRateLimit = createRateLimit({
  name: 'auth',
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many authentication attempts',
    code: 'RATE_LIMIT_AUTH',
    retryAfter: 15 * 60,
  },
  skip: (req) => req.path === '/auth/logout',
});

export const apiRateLimit = createRateLimit({
  name: 'api',
  windowMs: 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests',
    code: 'RATE_LIMIT_API',
    retryAfter: 60,
  },
  keyGenerator: (req) => (req.session as unknown as Record<string, string>)?.userId || req.ip || 'anonymous',
  skip: (req) => req.path === '/health',
});

export const queryRateLimit = createRateLimit({
  name: 'query',
  windowMs: 60 * 1000,
  max: 20,
  message: {
    error: 'Too many query requests',
    code: 'RATE_LIMIT_QUERY',
    retryAfter: 60,
  },
  keyGenerator: (req) => (req.session as unknown as Record<string, string>)?.userId || req.ip || 'anonymous',
});
