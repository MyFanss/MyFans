#!/usr/bin/env ts-node
/**
 * Contract health check script — run by CI after contract deployment.
 * Loads contract IDs from artifact or env vars, invokes read methods,
 * and exits non-zero if any contract is unavailable or mismatched.
 *
 * RPC resilience (issue #1801):
 * - Reads are retried with exponential backoff + jitter under a bounded budget.
 * - Each RPC call is bounded by a per-call timeout.
 * - Reads may degrade (report failure) but never falsely report success.
 * - Writes are fail-closed: a failed/timed-out write is never reported as success.
 * - Set USE_MOCK_RPC=1 (or RPC_MOCK=1) to route through the mock RPC in CI.
 */
import { ContractHealthService } from '../src/contract-health/contract-health.service';
import { loadContractIds } from '../src/contract-health/contract-ids.loader';

const DEFAULT_RPC_URL = 'https://soroban-testnet.stellar.org';
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_BASE_DELAY_MS = 200;
const DEFAULT_MAX_DELAY_MS = 4_000;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const RPC_TIMEOUT_MS = envInt('RPC_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
const RPC_MAX_ATTEMPTS = envInt('RPC_MAX_ATTEMPTS', DEFAULT_MAX_ATTEMPTS);
const RPC_BASE_DELAY_MS = envInt('RPC_BASE_DELAY_MS', DEFAULT_BASE_DELAY_MS);
const RPC_MAX_DELAY_MS = envInt('RPC_MAX_DELAY_MS', DEFAULT_MAX_DELAY_MS);

function useMockRpc(): boolean {
  return process.env.USE_MOCK_RPC === '1' || process.env.RPC_MOCK === '1';
}

function resolveRpcUrl(): string {
  if (useMockRpc()) {
    return process.env.MOCK_RPC_URL ?? 'http://127.0.0.1:8545';
  }
  return process.env.SOROBAN_RPC_URL ?? DEFAULT_RPC_URL;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Exponential backoff with full jitter, bounded by RPC_MAX_DELAY_MS.
 * Jitter prevents synchronized retry storms across CI runners.
 */
function backoffDelay(attempt: number): number {
  const exp = Math.min(RPC_MAX_DELAY_MS, RPC_BASE_DELAY_MS * 2 ** (attempt - 1));
  return Math.floor(Math.random() * exp);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`RPC timeout after ${timeoutMs}ms: ${label}`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Retry a read operation with a bounded budget. Reads may degrade: on
 * exhaustion we surface the failure rather than fabricating a success.
 */
async function retryRead<T>(label: string, op: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RPC_MAX_ATTEMPTS; attempt++) {
    try {
      return await withTimeout(op(), RPC_TIMEOUT_MS, label);
    } catch (err) {
      lastError = err;
      if (attempt < RPC_MAX_ATTEMPTS) {
        await sleep(backoffDelay(attempt));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Fail-closed write: a mutating RPC call must never be reported as success
 * when it fails or times out. We do not retry writes here to avoid
 * duplicate side effects; the caller must observe the failure.
 */
async function failClosedWrite<T>(label: string, op: () => Promise<T>): Promise<T> {
  try {
    return await withTimeout(op(), RPC_TIMEOUT_MS, label);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Write failed (fail-closed): ${label}: ${message}`);
  }
}

async function main() {
  const service = new ContractHealthService();
  const ids = loadContractIds();
  const rpcUrl = resolveRpcUrl();

  console.log('Running contract health checks...');
  console.log(`RPC: ${rpcUrl}${useMockRpc() ? ' (mock)' : ''}`);
  console.log(
    `Retry: maxAttempts=${RPC_MAX_ATTEMPTS} baseDelay=${RPC_BASE_DELAY_MS}ms ` +
      `maxDelay=${RPC_MAX_DELAY_MS}ms timeout=${RPC_TIMEOUT_MS}ms`,
  );
  console.log(`Contracts: ${JSON.stringify(ids)}\n`);

  const checks = await Promise.all([
    retryRead('myfans:is_subscriber', () =>
      service.checkContract('myfans', ids.myfans, 'is_subscriber', []),
    ),
    retryRead('myfans-token:version', () =>
      service.checkContract('myfans-token', ids.myfansToken, 'version', []),
    ),
  ]);

  let failed = false;

  for (const result of checks) {
    const status = result.ok ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}  ${result.contract} (${result.contractId}) — ${result.durationMs}ms`);
    if (!result.ok) {
      console.error(`       Error: ${result.error}`);
      failed = true;
    }
  }

  if (failed) {
    console.error('\nContract health checks failed.');
    process.exit(1);
  }

  console.log('\nAll contract health checks passed.');
}

// Exported for unit tests (retry/timeout/fail-closed behavior).
export { retryRead, failClosedWrite, withTimeout, backoffDelay };

if (require.main === module) {
  main().catch((err) => {
    console.error('Unexpected error:', err.message);
    process.exit(1);
  });
}
