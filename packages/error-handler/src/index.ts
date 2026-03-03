/**
 * @hmc/error-handler - Standardized error handling for Express apps
 *
 * Provides:
 * - AppError class with status codes and error codes
 * - Common error factory (NotFound, Unauthorized, Forbidden, etc.)
 * - Production-safe error sanitization (no stack traces in prod)
 * - Async route handler wrapper
 * - Standardized API response envelope
 * - Zod request validation middleware
 */

export { AppError, Errors, sanitizeError, sendError, asyncHandler } from './errors.js';
export type { ErrorResponse } from './errors.js';
export { sendSuccess, sendPaginatedSuccess, sendApiError, sendCreated } from './apiResponse.js';
export type { ApiMeta, PaginationMeta } from './apiResponse.js';
export { validateBody, validateQuery, validateParams } from './validation.js';
