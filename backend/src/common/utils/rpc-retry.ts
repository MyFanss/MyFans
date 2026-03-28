export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 4 */
  maxAttempts?: number;
  /** Base delay in ms for exponential backoff. Default: 200 */
  baseDelayMs?: number;
  /** Maximum delay cap in ms. Default: 5000 */
  maxDelayMs?: number;
  /** Number of consecutive failures before the circuit opens. Default: 5 */
  circuitBreakerThreshold?: number;
  /** How long (ms) the circuit stays open before allowing a probe. Default: 30000 */
  circuitResetMs?: number;
  /** Return true for errors that should NOT be retried (permanent). */
  isPermanentError?: (err: unknown) => boolean;
}

export class CircuitOpenError extends Error {
  constructor() {
    super('Circuit breaker is open – too many consecutive RPC failures');
    this.name = 'CircuitOpenError';
  }
}

interface CircuitState {
  failures: number;
  openedAt: number | null;
}

const circuits = new Map<string, CircuitState>();

function getCircuit(key: string): CircuitState {
  if (!circuits.has(key)) circuits.set(key, { failures: 0, openedAt: null });
  return circuits.get(key)!;
}

/** Exposed for testing only. */
export function resetCircuit(key: string): void {
  circuits.delete(key);
}

function jitteredDelay(attempt: number, base: number, cap: number): number {
  const exp = Math.min(base * 2 ** attempt, cap);
  return Math.floor(exp / 2 + Math.random() * (exp / 2));
}

/**
 * Executes `fn` with bounded retries, jittered backoff, and a per-key circuit breaker.
 *
 * @param key    Logical name for the circuit (e.g. 'soroban-rpc').
 * @param fn     Async operation to attempt.
 * @param opts   Retry / circuit-breaker configuration.
 */
export async function withRetry<T>(
  key: string,
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 4,
    baseDelayMs = 200,
    maxDelayMs = 5000,
    circuitBreakerThreshold = 5,
    circuitResetMs = 30_000,
    isPermanentError,
  } = opts;

  const circuit = getCircuit(key);

  // Circuit open?
  if (circuit.openedAt !== null) {
    if (Date.now() - circuit.openedAt < circuitResetMs) {
      throw new CircuitOpenError();
    }
    // Half-open: allow one probe
    circuit.openedAt = null;
  }

  let lastErr: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await fn();
      circuit.failures = 0; // success resets the counter
      return result;
    } catch (err) {
      lastErr = err;

      if (isPermanentError?.(err)) {
        circuit.failures = 0;
        throw err;
      }

      circuit.failures += 1;
      if (circuit.failures >= circuitBreakerThreshold) {
        circuit.openedAt = Date.now();
        throw new CircuitOpenError();
      }

      if (attempt < maxAttempts - 1) {
        await new Promise((r) =>
          setTimeout(r, jitteredDelay(attempt, baseDelayMs, maxDelayMs)),
        );
      }
    }
  }

  throw lastErr;
}
