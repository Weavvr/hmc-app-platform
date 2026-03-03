import { Response } from 'express';
import { createLogger } from '@hmc/logger';

const logger = createLogger('error');
const isProduction = process.env.NODE_ENV === 'production';

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const Errors = {
  NotFound: (resource = 'Resource') =>
    new AppError(`${resource} not found`, 404, 'NOT_FOUND'),
  Unauthorized: (message = 'Unauthorized') =>
    new AppError(message, 401, 'UNAUTHORIZED'),
  Forbidden: (message = 'Access denied') =>
    new AppError(message, 403, 'FORBIDDEN'),
  BadRequest: (message = 'Bad request') =>
    new AppError(message, 400, 'BAD_REQUEST'),
  Conflict: (message = 'Conflict') =>
    new AppError(message, 409, 'CONFLICT'),
  ValidationError: (message = 'Validation failed') =>
    new AppError(message, 400, 'VALIDATION_ERROR'),
  RateLimited: (message = 'Too many requests') =>
    new AppError(message, 429, 'RATE_LIMITED'),
  Internal: (message = 'Internal server error') =>
    new AppError(message, 500, 'INTERNAL_ERROR', false),
};

export function sanitizeError(error: unknown): ErrorResponse {
  if (error instanceof AppError) {
    return { error: error.message, code: error.code };
  }

  if (error instanceof Error) {
    if (isProduction) {
      if (error.name === 'ZodError') {
        return { error: 'Validation failed', code: 'VALIDATION_ERROR' };
      }
      return { error: 'An unexpected error occurred', code: 'INTERNAL_ERROR' };
    }
    return {
      error: error.message,
      code: error.name,
      details: { stack: error.stack?.split('\n').slice(0, 5) },
    };
  }

  return {
    error: isProduction ? 'An unexpected error occurred' : String(error),
    code: 'UNKNOWN_ERROR',
  };
}

export function sendError(
  res: Response,
  error: unknown,
  context?: { userId?: string; path?: string }
): void {
  logger.error('Request error', error instanceof Error ? error : new Error(String(error)), context);

  let statusCode = 500;
  if (error instanceof AppError) {
    statusCode = error.statusCode;
  } else if (error instanceof Error) {
    if (error.message.includes('not found')) statusCode = 404;
    else if (error.message.includes('unauthorized')) statusCode = 401;
    else if (error.message.includes('forbidden')) statusCode = 403;
    else if (error.name === 'ZodError') statusCode = 400;
  }

  res.status(statusCode).json(sanitizeError(error));
}

export function asyncHandler<T>(
  fn: (req: T, res: Response) => Promise<void>
): (req: T, res: Response) => void {
  return (req, res) => {
    Promise.resolve(fn(req, res)).catch((error) => {
      sendError(res, error);
    });
  };
}
