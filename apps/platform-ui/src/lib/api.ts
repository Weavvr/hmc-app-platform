import type {
  Feature,
  AppRequest,
  DependencyResult,
  CatalogStats,
  NLPAnalysisResponse,
  ChatEntry,
} from './types';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || body.message || `Request failed: ${res.status}`);
  }

  return res.json();
}

// ── Catalog ──────────────────────────────────────────────────────────

export async function fetchFeatures(): Promise<Feature[]> {
  return request<Feature[]>('/catalog');
}

export async function fetchFeature(id: string): Promise<Feature> {
  return request<Feature>(`/catalog/${encodeURIComponent(id)}`);
}

export async function fetchDependencies(id: string): Promise<DependencyResult> {
  return request<DependencyResult>(`/catalog/${encodeURIComponent(id)}/dependencies`);
}

export async function fetchCatalogStats(): Promise<CatalogStats> {
  return request<CatalogStats>('/catalog/stats');
}

// ── App Generation ───────────────────────────────────────────────────

export async function generateApp(data: {
  name: string;
  description: string;
  features: string[];
  config: Record<string, string>;
}): Promise<{ requestId: string; status: string }> {
  return request('/generate', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── NLP ──────────────────────────────────────────────────────────────

export async function analyzeDescription(
  message: string,
  history?: ChatEntry[],
): Promise<NLPAnalysisResponse> {
  return request<NLPAnalysisResponse>('/nlp/analyze', {
    method: 'POST',
    body: JSON.stringify({ message, history }),
  });
}

// ── Requests ─────────────────────────────────────────────────────────

export async function fetchRequests(): Promise<AppRequest[]> {
  return request<AppRequest[]>('/requests');
}

export async function createRequest(data: Partial<AppRequest>): Promise<AppRequest> {
  return request<AppRequest>('/requests', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRequest(
  id: string,
  data: Partial<AppRequest>,
): Promise<AppRequest> {
  return request<AppRequest>(`/requests/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
