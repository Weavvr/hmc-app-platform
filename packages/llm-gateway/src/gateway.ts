import type { LLMProvider, LLMProviderName, GatewayQueryRequest, GatewayQueryResponse } from './types.js';
import { anthropicProvider } from './providers/anthropic.js';
import { openaiProvider } from './providers/openai.js';
import { geminiProvider } from './providers/gemini.js';
import { perplexityProvider, grokProvider, mistralProvider } from './providers/openaiCompatible.js';
import {
  withCircuitBreaker,
  getCircuitStatus,
  getAllCircuitStatuses,
  resetCircuit,
  type CircuitBreakerConfig,
} from './circuitBreaker.js';
import { createLogger } from '@hmc/logger';
import type { LLMProviderConfig } from './types.js';

const logger = createLogger('llm-gateway');

const providers: Partial<Record<LLMProviderName, LLMProvider>> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
  perplexity: perplexityProvider,
  grok: grokProvider,
  mistral: mistralProvider,
};

function wrapProviderWithCircuitBreaker(
  provider: LLMProvider,
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>
): LLMProvider {
  const wrapped: LLMProvider = {
    name: provider.name,
    async query(request: GatewayQueryRequest, config: LLMProviderConfig): Promise<GatewayQueryResponse> {
      return withCircuitBreaker(provider.name, () => provider.query(request, config), circuitBreakerConfig);
    },
  };

  if (provider.streamQuery) {
    wrapped.streamQuery = async (
      request: GatewayQueryRequest,
      config: LLMProviderConfig,
      onChunk: (text: string) => void
    ): Promise<GatewayQueryResponse> => {
      return withCircuitBreaker(provider.name, () => provider.streamQuery!(request, config, onChunk), circuitBreakerConfig);
    };
  }

  return wrapped;
}

/** Register a custom provider (e.g., Cohere, or a custom internal LLM) */
export function registerProvider(provider: LLMProvider): void {
  providers[provider.name] = provider;
  logger.info('Custom provider registered', { provider: provider.name });
}

/** Get an LLM provider by name, wrapped with circuit breaker protection */
export function getLLMProvider(
  name: LLMProviderName,
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>
): LLMProvider {
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown or unsupported LLM provider: ${name}`);

  const status = getCircuitStatus(name);
  if (status.state === 'open') {
    logger.warn('Provider circuit is open', { provider: name, failures: status.failures });
  }

  return wrapProviderWithCircuitBreaker(provider, circuitBreakerConfig);
}

/** Get a raw provider without circuit breaker */
export function getRawLLMProvider(name: LLMProviderName): LLMProvider {
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown or unsupported LLM provider: ${name}`);
  return provider;
}

/** Get all registered providers */
export function getAllProviders(): LLMProvider[] {
  return Object.values(providers).filter((p): p is LLMProvider => p !== undefined);
}

/** Get health status of all providers */
export function getProvidersHealth(): Map<string, {
  name: string;
  circuitState: string;
  failures: number;
  lastFailure: number;
  healthy: boolean;
}> {
  const health = new Map<string, { name: string; circuitState: string; failures: number; lastFailure: number; healthy: boolean }>();
  const statuses = getAllCircuitStatuses();

  for (const [name, provider] of Object.entries(providers)) {
    if (!provider) continue;
    const status = statuses.get(name) || { state: 'closed', failures: 0, lastFailure: 0 };
    health.set(name, {
      name,
      circuitState: status.state,
      failures: status.failures,
      lastFailure: status.lastFailure,
      healthy: status.state !== 'open',
    });
  }

  return health;
}

/** Reset a provider's circuit breaker */
export function resetProviderCircuit(name: LLMProviderName): void {
  resetCircuit(name);
  logger.info('Provider circuit reset by admin', { provider: name });
}

/** Find an available healthy provider as fallback */
export function findHealthyProvider(excludeProvider?: LLMProviderName): LLMProvider | null {
  const health = getProvidersHealth();
  for (const [name, status] of health) {
    if (name !== excludeProvider && status.healthy) {
      const provider = providers[name as LLMProviderName];
      if (provider) {
        logger.info('Using fallback provider', { provider: name, excluded: excludeProvider });
        return wrapProviderWithCircuitBreaker(provider);
      }
    }
  }
  return null;
}
