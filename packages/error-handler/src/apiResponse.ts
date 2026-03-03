import { Response } from 'express';

export interface ApiMeta {
  timestamp: string;
  correlationId?: string;
  [key: string]: unknown;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  meta?: Partial<ApiMeta>,
  statusCode: number = 200
): void {
  res.status(statusCode).json({
    data,
    error: null,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
}

export function sendPaginatedSuccess<T>(
  res: Response,
  data: T,
  pagination: { total: number; limit: number; offset: number },
  meta?: Partial<ApiMeta>
): void {
  res.status(200).json({
    data,
    error: null,
    meta: {
      timestamp: new Date().toISOString(),
      pagination: {
        ...pagination,
        hasMore: pagination.offset + pagination.limit < pagination.total,
      } as PaginationMeta,
      ...meta,
    },
  });
}

export function sendApiError(
  res: Response,
  statusCode: number,
  message: string,
  correlationId?: string,
  details?: unknown
): void {
  res.status(statusCode).json({
    data: null,
    error: message,
    meta: {
      timestamp: new Date().toISOString(),
      correlationId,
      ...(details ? { details } : {}),
    },
  });
}

export function sendCreated<T>(
  res: Response,
  data: T,
  meta?: Partial<ApiMeta>
): void {
  sendSuccess(res, data, meta, 201);
}
