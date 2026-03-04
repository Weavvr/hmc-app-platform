/**
 * Circuit Breaker and Retry Logic for LLM Providers
 *
 * Implements the circuit breaker pattern to prevent cascading failures
 * and automatic retry logic with exponential backoff.
 */

import { createLogger } from '@hmc/logger';

const logger = createLogger('circuit-breaker');

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  requestTimeout: number;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailure: number;
  successesSinceHalfOpen: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 30000,
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  requestTimeout: 60000,
};

const circuitStates = new Map<string, CircuitBreakerState>();

function getCircuitState(providerName: string): CircuitBreakerState {
  if (!circuitStates.has(providerName)) {
    circuitStates.set(providerName, {
      state: 'closed',
      failures: 0,
      lastFailure: 0,
      successesSinceHalfOpen: 0,
    });
  }
  return circuitStates.get(providerName)!;
}

export function isCircuitOpen(providerName: string, config: Partial<CircuitBreakerConfig> = {}): boolean {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const circuit = getCircuitState(providerName);

  if (circuit.state === 'open') {
    const timeSinceLastFailure = Date.now() - circuit.lastFailure;
    if (timeSinceLastFailure >= fullConfig.resetTimeout) {
      circuit.state = 'half-open';
      circuit.successesSinceHalfOpen = 0;
      logger.info('Circuit transitioning to half-open', { provider: providerName });
      return false;
    }
    return true;
  }

  return false;
}

export function recordSuccess(providerName: string): void {
  const circuit = getCircuitState(providerName);
  if (circuit.state === 'half-open') {
    circuit.successesSinceHalfOpen++;
    if (circuit.successesSinceHalfOpen >= 2) {
      circuit.state = 'closed';
      circuit.failures = 0;
      logger.info('Circuit closed after successful recovery', { provider: providerName });
    }
  } else if (circuit.state === 'closed') {
    circuit.failures = 0;
  }
}

export function recordFailure(providerName: string, config: Partial<CircuitBreakerConfig> = {}): void {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const circuit = getCircuitState(providerName);

  circuit.failures++;
  circuit.lastFailure = Date.now();

  if (circuit.state === 'half-open') {
    circuit.state = 'open';
    logger.warn('Circuit reopened after failure in half-open state', { provider: providerName });
  } else if (circuit.failures >= fullConfig.failureThreshold) {
    circuit.state = 'open';
    logger.warn('Circuit opened due to failure threshold', {
      provider: providerName,
      failures: circuit.failures,
      threshold: fullConfig.failureThreshold,
    });
  }
}

export function getCircuitStatus(providerName: string): {
  state: CircuitState;
  failures: number;
  lastFailure: number;
} {
  const circuit = getCircuitState(providerName);
  return { state: circuit.state, failures: circuit.failures, lastFailure: circuit.lastFailure };
}

export function resetCircuit(providerName: string): void {
  circuitStates.set(providerName, {
    state: 'closed',
    failures: 0,
    lastFailure: 0,
    successesSinceHalfOpen: 0,
  });
  logger.info('Circuit manually reset', { provider: providerName });
}

export function calculateBackoff(attempt: number, config: Partial<CircuitBreakerConfig> = {}): number {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const delay = Math.min(fullConfig.baseDelay * Math.pow(2, attempt), fullConfig.maxDelay);
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  if (message.includes('network') || message.includes('econnreset') || message.includes('etimedout')) return true;
  if (message.includes('rate limit') || message.includes('429') || message.includes('too many requests')) return true;
  if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) return true;
  if (message.includes('timeout') || message.includes('timed out')) return true;
  if (message.includes('overloaded') || message.includes('capacity')) return true;
  return false;
}

export async function withCircuitBreaker<T>(
  providerName: string,
  fn: () => Promise<T>,
  config: Partial<CircuitBreakerConfig> = {}
): Promise<T> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  if (isCircuitOpen(providerName, config)) {
    const circuit = getCircuitState(providerName);
    const timeUntilRetry = fullConfig.resetTimeout - (Date.now() - circuit.lastFailure);
    throw new Error(
      `Circuit breaker is open for provider ${providerName}. Retry in ${Math.ceil(timeUntilRetry / 1000)}s`
    );
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), fullConfig.requestTimeout);
      });

      const result = await Promise.race([fn(), timeoutPromise]);
      recordSuccess(providerName);

      if (attempt > 0) {
        logger.info('Request succeeded after retry', { provider: providerName, attempt });
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      logger.warn('Request failed', {
        provider: providerName,
        attempt,
        error: lastError.message,
        retryable: isRetryableError(lastError),
      });

      if (!isRetryableError(lastError)) {
        recordFailure(providerName, config);
        throw lastError;
      }

      recordFailure(providerName, config);

      if (attempt < fullConfig.maxRetries) {
        const delay = calculateBackoff(attempt, config);
        logger.info('Retrying request', { provider: providerName, attempt: attempt + 1, delayMs: delay });
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error(`Request failed after ${fullConfig.maxRetries} retries`);
}

export function getAllCircuitStatuses(): Map<string, {
  state: CircuitState;
  failures: number;
  lastFailure: number;
}> {
  const statuses = new Map<string, { state: CircuitState; failures: number; lastFailure: number }>();
  for (const [name, circuit] of circuitStates) {
    statuses.set(name, { state: circuit.state, failures: circuit.failures, lastFailure: circuit.lastFailure });
  }
  return statuses;
}
