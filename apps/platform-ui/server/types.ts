// ── Feature Catalog Types ───────────────────────────────────────

export interface Feature {
  id: string;
  name: string;
  displayName: string;
  description: string;
  tier: number;
  complexity: 'low' | 'medium' | 'high';
  package: string;
  status: 'stable' | 'beta' | 'planned' | 'deprecated';
  bestSource: string;
  alsoIn: string[];
  dependencies: string[];
  configRequired: string[];
  tags: string[];
  category: string;
}

// ── Dependency Resolution ───────────────────────────────────────

export interface DependencyNode {
  id: string;
  name: string;
  displayName: string;
  children: DependencyNode[];
}

// ── App Request ─────────────────────────────────────────────────

export type AppRequestStatus =
  | 'pending'
  | 'approved'
  | 'generating'
  | 'complete'
  | 'failed';

export interface AppRequest {
  id: string;
  name: string;
  description: string;
  selectedFeatures: string[];
  configuration: Record<string, string>;
  status: AppRequestStatus;
  createdAt: string;
  updatedAt: string;
  repoUrl?: string;
  nlpConversation?: Array<{ role: string; content: string }>;
}

// ── Generator ───────────────────────────────────────────────────

export interface GenerateOptions {
  name: string;
  description: string;
  features: string[];
  config: Record<string, string>;
}

export interface GenerateResult {
  success: boolean;
  repoUrl?: string;
  features: string[];
  config: Record<string, string>;
  error?: string;
}

// ── NLP ─────────────────────────────────────────────────────────

export interface NLPResult {
  response: string;
  suggestedFeatures: string[];
  confidence: Record<string, number>;
}

// ── Catalog Stats ───────────────────────────────────────────────

export interface CatalogStats {
  totalFeatures: number;
  byTier: Record<number, number>;
  byStatus: Record<string, number>;
  byComplexity: Record<string, number>;
  byCategory: Record<string, number>;
}
