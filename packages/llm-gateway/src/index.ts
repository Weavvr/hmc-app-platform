/**
 * @hmc/llm-gateway - Multi-provider LLM routing with circuit breakers
 *
 * Provides:
 * - 6 built-in providers: Anthropic, OpenAI, Gemini, Perplexity, Grok, Mistral
 * - Circuit breaker pattern with exponential backoff
 * - Streaming support for all providers
 * - Token limit validation and model recommendations
 * - Provider health monitoring and fallback selection
 * - Custom provider registration
 */

export {
  getLLMProvider,
  getRawLLMProvider,
  getAllProviders,
  getProvidersHealth,
  resetProviderCircuit,
  findHealthyProvider,
  registerProvider,
} from './gateway.js';

export * from './types.js';
export * from './circuitBreaker.js';
export * from './tokenLimits.js';
