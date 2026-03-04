/**
 * Token limits and validation for LLM providers.
 * Context windows and output limits for supported models.
 */

export interface ModelLimits {
  contextWindow: number;
  maxOutput: number;
}

export const MODEL_LIMITS: Record<string, ModelLimits> = {
  // Anthropic Claude 4.5/4.6
  'claude-opus-4-6': { contextWindow: 200000, maxOutput: 64000 },
  'claude-sonnet-4-6': { contextWindow: 200000, maxOutput: 64000 },
  'claude-opus-4-5-20251101': { contextWindow: 200000, maxOutput: 64000 },
  'claude-sonnet-4-5-20250929': { contextWindow: 200000, maxOutput: 64000 },
  'claude-opus-4-5': { contextWindow: 200000, maxOutput: 64000 },
  'claude-sonnet-4-5': { contextWindow: 200000, maxOutput: 64000 },
  'claude-sonnet-4-20250514': { contextWindow: 200000, maxOutput: 64000 },
  'claude-opus-4-20250514': { contextWindow: 200000, maxOutput: 64000 },
  'claude-sonnet-3-7-20250219': { contextWindow: 200000, maxOutput: 64000 },
  'claude-3-5-sonnet-20241022': { contextWindow: 200000, maxOutput: 8192 },
  'claude-3-5-haiku-20241022': { contextWindow: 200000, maxOutput: 8192 },

  // OpenAI
  'o3': { contextWindow: 200000, maxOutput: 100000 },
  'o3-mini': { contextWindow: 200000, maxOutput: 100000 },
  'o1': { contextWindow: 200000, maxOutput: 100000 },
  'o1-mini': { contextWindow: 128000, maxOutput: 65536 },
  'gpt-4o': { contextWindow: 128000, maxOutput: 16384 },
  'gpt-4o-mini': { contextWindow: 128000, maxOutput: 16384 },
  'gpt-4': { contextWindow: 8192, maxOutput: 4096 },
  'gpt-4-turbo': { contextWindow: 128000, maxOutput: 4096 },

  // Google Gemini
  'gemini-1.5-pro': { contextWindow: 2000000, maxOutput: 8192 },
  'gemini-1.5-flash': { contextWindow: 1000000, maxOutput: 8192 },
  'gemini-2.0-flash-exp': { contextWindow: 1000000, maxOutput: 8192 },

  // Perplexity
  'sonar-pro': { contextWindow: 200000, maxOutput: 8192 },
  'sonar': { contextWindow: 128000, maxOutput: 4096 },
  'sonar-reasoning': { contextWindow: 128000, maxOutput: 8192 },

  // xAI Grok
  'grok-4': { contextWindow: 256000, maxOutput: 16384 },
  'grok-4-fast': { contextWindow: 2000000, maxOutput: 16384 },
  'grok-2': { contextWindow: 131072, maxOutput: 4096 },

  // Mistral
  'mistral-large-latest': { contextWindow: 128000, maxOutput: 4096 },
  'mistral-medium-latest': { contextWindow: 32000, maxOutput: 4096 },

  // Cohere
  'command-r-plus': { contextWindow: 128000, maxOutput: 4096 },
  'command-r': { contextWindow: 128000, maxOutput: 4096 },
};

const DEFAULT_LIMITS: ModelLimits = { contextWindow: 32000, maxOutput: 4096 };

export function getModelLimits(modelId: string): ModelLimits {
  if (MODEL_LIMITS[modelId]) return MODEL_LIMITS[modelId];

  for (const [key, limits] of Object.entries(MODEL_LIMITS)) {
    if (modelId.includes(key) || key.includes(modelId)) return limits;
  }

  if (modelId.includes('claude')) return { contextWindow: 200000, maxOutput: 64000 };
  if (modelId.includes('gpt-4o') || modelId.includes('gpt-5')) return { contextWindow: 128000, maxOutput: 16384 };
  if (modelId.includes('gemini')) return { contextWindow: 1000000, maxOutput: 8192 };
  if (modelId.includes('o1') || modelId.includes('o3')) return { contextWindow: 200000, maxOutput: 100000 };

  return DEFAULT_LIMITS;
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.5);
}

export function validateContextFits(
  content: string,
  modelId: string,
  reservedOutputTokens: number = 8192
): { valid: boolean; estimatedTokens: number; maxInputTokens: number; error?: string } {
  const limits = getModelLimits(modelId);
  const estimatedTokens = estimateTokens(content);
  const maxInputTokens = limits.contextWindow - reservedOutputTokens;

  if (estimatedTokens > maxInputTokens) {
    return {
      valid: false,
      estimatedTokens,
      maxInputTokens,
      error: `Document too large for ${modelId}. Estimated ~${estimatedTokens.toLocaleString()} tokens, limit ~${maxInputTokens.toLocaleString()}.`,
    };
  }

  return { valid: true, estimatedTokens, maxInputTokens };
}

export function getModelRecommendations(contentTokens: number): string[] {
  const suitable: string[] = [];
  const checkModels = ['gemini-1.5-pro', 'gemini-1.5-flash', 'claude-opus-4-6', 'claude-sonnet-4-6', 'o3', 'gpt-4o'];
  for (const model of checkModels) {
    const limits = getModelLimits(model);
    if (limits.contextWindow - 8192 >= contentTokens) suitable.push(model);
  }
  return suitable;
}
