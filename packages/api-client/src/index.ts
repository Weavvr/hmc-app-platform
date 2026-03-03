/**
 * @hmc/api-client - Browser-side API client with CSRF, session handling, and typed responses
 *
 * Provides:
 * - createApiClient() factory for typed fetch wrapper
 * - Automatic CSRF token from cookies
 * - Session expiry detection with configurable callback
 * - Standard envelope parsing: { data, error, meta }
 */

import type { ApiResponse, PaginatedResponse } from '@hmc/types';

export interface ApiClientConfig {
  /** Base URL for API requests (default: '' for same-origin) */
  baseUrl?: string;
  /** Called when a 401 response indicates session expiry */
  onSessionExpired?: () => void;
  /** Additional default headers */
  defaultHeaders?: Record<string, string>;
}

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function createApiClient(config: ApiClientConfig = {}) {
  const baseUrl = config.baseUrl ?? '';

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.defaultHeaders,
    };

    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken;
    }

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });

    if (res.status === 401) {
      config.onSessionExpired?.();
      return { error: 'Session expired' };
    }

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      return { error: (errorBody as { error?: string }).error || `Request failed: ${res.status}` };
    }

    return await res.json() as ApiResponse<T>;
  }

  return {
    get<T>(path: string, options?: RequestInit) {
      return request<T>('GET', path, undefined, options);
    },

    post<T>(path: string, body?: unknown, options?: RequestInit) {
      return request<T>('POST', path, body, options);
    },

    put<T>(path: string, body?: unknown, options?: RequestInit) {
      return request<T>('PUT', path, body, options);
    },

    patch<T>(path: string, body?: unknown, options?: RequestInit) {
      return request<T>('PATCH', path, body, options);
    },

    delete<T>(path: string, options?: RequestInit) {
      return request<T>('DELETE', path, undefined, options);
    },

    /** Upload files with automatic CSRF */
    async upload<T>(path: string, formData: FormData, options?: RequestInit): Promise<ApiResponse<T>> {
      const headers: Record<string, string> = { ...config.defaultHeaders };
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: formData,
        ...options,
      });

      if (res.status === 401) {
        config.onSessionExpired?.();
        return { error: 'Session expired' };
      }

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        return { error: (errorBody as { error?: string }).error || `Upload failed: ${res.status}` };
      }

      return await res.json() as ApiResponse<T>;
    },

    /** Fetch a paginated endpoint */
    async paginated<T>(
      path: string,
      params?: { page?: number; limit?: number; [key: string]: unknown }
    ): Promise<PaginatedResponse<T>> {
      const searchParams = new URLSearchParams();
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined && value !== null) {
            searchParams.set(key, String(value));
          }
        }
      }
      const queryString = searchParams.toString();
      const fullPath = queryString ? `${path}?${queryString}` : path;
      return request<T[]>('GET', fullPath) as Promise<PaginatedResponse<T>>;
    },
  };
}

export type { ApiResponse, PaginatedResponse } from '@hmc/types';
