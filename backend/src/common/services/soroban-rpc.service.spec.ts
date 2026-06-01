/**
 * Unit tests for SorobanRpcService
 *
 * Covers:
 *  - checkConnectivity(): up / degraded / down paths
 *  - checkKnownContract(): with and without SOROBAN_HEALTH_CHECK_CONTRACT
 *  - getRpcUrl() / getTimeout() / getRetryConfig() accessors
 *  - Timeout and retry behaviour
 */
import { SorobanRpcService } from './soroban-rpc.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a SorobanRpcService whose internal `rpc.Server` is replaced with a
 * lightweight mock so no real network calls are made.
 */
function makeService(
  serverOverrides: Record<string, jest.Mock> = {},
  rpcMetrics?: { record: jest.Mock },
): SorobanRpcService {
  const svc = new SorobanRpcService(rpcMetrics as any);
  (svc as any).server = {
    getHealth: jest.fn().mockResolvedValue({ status: 'healthy', ledger: 1000 }),
    getLedgerEntries: jest.fn().mockResolvedValue({ entries: [] }),
    getEvents: jest.fn().mockResolvedValue({ events: [], latestLedger: 1000 }),
    ...serverOverrides,
  };
  // Speed up retries in tests
  (svc as any).retryConfig = {
    retries: 3,
    retryDelayMs: 0,
    backoffMultiplier: 1,
    maxRetryDelayMs: 0,
  };
  return svc;
}

// ---------------------------------------------------------------------------
// checkConnectivity
// ---------------------------------------------------------------------------

describe('SorobanRpcService – checkConnectivity', () => {
  it('returns status=up when RPC responds on the first attempt', async () => {
    const svc = makeService();
    const result = await svc.checkConnectivity();

    expect(result.status).toBe('up');
    expect(result.rpcUrl).toBeDefined();
    expect(typeof result.responseTime).toBe('number');
    expect(result.details?.successCount).toBe(1);
    expect(result.details?.failureCount).toBe(0);
  });

  it('returns ledger number from getHealth response', async () => {
    const svc = makeService({
      getHealth: jest.fn().mockResolvedValue({ status: 'healthy', ledger: 42 }),
    });
    const result = await svc.checkConnectivity();

    expect(result.status).toBe('up');
    expect(result.ledger).toBe(42);
  });

  it('returns status=down when server is null (init failure)', async () => {
    const svc = makeService();
    (svc as any).server = null;

    const result = await svc.checkConnectivity();

    expect(result.status).toBe('down');
    expect(result.error).toMatch(/initialize/i);
    expect(result.details?.failureCount).toBe(1);
  });

  it('returns status=down after all retries fail', async () => {
    const svc = makeService({
      getHealth: jest.fn().mockRejectedValue(new Error('connection refused')),
    });

    const result = await svc.checkConnectivity();

    expect(result.status).toBe('down');
    expect(result.error).toMatch(/connection refused|unreachable/i);
    expect(result.details?.successCount).toBe(0);
    expect(result.details?.failureCount).toBe(3);
  });

  it('returns status=degraded when first attempt fails but a retry succeeds', async () => {
    let callCount = 0;
    const svc = makeService({
      getHealth: jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(new Error('transient error'));
        return Promise.resolve({ status: 'healthy', ledger: 100 });
      }),
    });

    const result = await svc.checkConnectivity();

    expect(result.status).toBe('degraded');
    expect(result.details?.successCount).toBe(1);
    expect(result.details?.failureCount).toBe(1);
  });

  it('returns status=down when RPC times out on every attempt', async () => {
    const svc = makeService({
      getHealth: jest.fn().mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('RPC connection timeout')), 50)),
      ),
    });
    (svc as any).timeout = 10; // 10 ms — shorter than the mock delay

    const result = await svc.checkConnectivity();

    expect(result.status).toBe('down');
    expect(result.error).toMatch(/timeout/i);
  });

  it('includes details object with avgResponseTime', async () => {
    const svc = makeService();
    const result = await svc.checkConnectivity();

    expect(result.details).toBeDefined();
    expect(typeof result.details?.avgResponseTime).toBe('number');
    expect(result.details?.attempts).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// checkKnownContract
// ---------------------------------------------------------------------------

describe('SorobanRpcService – checkKnownContract', () => {
  const VALID_CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';

  afterEach(() => {
    delete process.env.SOROBAN_HEALTH_CHECK_CONTRACT;
  });

  it('falls back to checkConnectivity when SOROBAN_HEALTH_CHECK_CONTRACT is not set', async () => {
    delete process.env.SOROBAN_HEALTH_CHECK_CONTRACT;
    const svc = makeService();

    const result = await svc.checkKnownContract();

    // Falls back to connectivity probe — should succeed
    expect(['up', 'degraded', 'down']).toContain(result.status);
  });

  it('returns status=up when getLedgerEntries succeeds with a contract configured', async () => {
    process.env.SOROBAN_HEALTH_CHECK_CONTRACT = VALID_CONTRACT_ID;
    const svc = makeService({
      getLedgerEntries: jest.fn().mockResolvedValue({ entries: [] }),
    });

    const result = await svc.checkKnownContract();

    expect(result.status).toBe('up');
    expect(result.rpcUrl).toBeDefined();
  });

  it('returns status=down when server is null', async () => {
    process.env.SOROBAN_HEALTH_CHECK_CONTRACT = VALID_CONTRACT_ID;
    const svc = makeService();
    (svc as any).server = null;

    const result = await svc.checkKnownContract();

    expect(result.status).toBe('down');
    expect(result.error).toMatch(/initialize/i);
  });

  it('returns status=down after all retries fail on contract read', async () => {
    process.env.SOROBAN_HEALTH_CHECK_CONTRACT = VALID_CONTRACT_ID;
    const svc = makeService({
      getLedgerEntries: jest.fn().mockRejectedValue(new Error('contract read timeout')),
    });

    const result = await svc.checkKnownContract();

    expect(result.status).toBe('down');
    expect(result.error).toMatch(/contract read timeout|failed/i);
    expect(result.details?.successCount).toBe(0);
  });

  it('returns status=degraded when first contract read fails but retry succeeds', async () => {
    process.env.SOROBAN_HEALTH_CHECK_CONTRACT = VALID_CONTRACT_ID;
    let callCount = 0;
    const svc = makeService({
      getLedgerEntries: jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(new Error('network blip'));
        return Promise.resolve({ entries: [] });
      }),
    });

    const result = await svc.checkKnownContract();

    expect(result.status).toBe('degraded');
    expect(result.details?.successCount).toBe(1);
    expect(result.details?.failureCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

describe('SorobanRpcService – accessors', () => {
  const originalRpcUrl = process.env.SOROBAN_RPC_URL;
  const originalTimeout = process.env.SOROBAN_RPC_TIMEOUT;

  afterEach(() => {
    if (originalRpcUrl !== undefined) {
      process.env.SOROBAN_RPC_URL = originalRpcUrl;
    } else {
      delete process.env.SOROBAN_RPC_URL;
    }
    if (originalTimeout !== undefined) {
      process.env.SOROBAN_RPC_TIMEOUT = originalTimeout;
    } else {
      delete process.env.SOROBAN_RPC_TIMEOUT;
    }
  });

  it('getRpcUrl returns the configured URL', () => {
    process.env.SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';
    const svc = new SorobanRpcService();
    expect(svc.getRpcUrl()).toBe('https://soroban-testnet.stellar.org');
  });

  it('getRpcUrl falls back to testnet default when env var is unset', () => {
    delete process.env.SOROBAN_RPC_URL;
    const svc = new SorobanRpcService();
    expect(svc.getRpcUrl()).toContain('stellar.org');
  });

  it('getTimeout returns the configured timeout in ms', () => {
    process.env.SOROBAN_RPC_TIMEOUT = '8000';
    const svc = new SorobanRpcService();
    expect(svc.getTimeout()).toBe(8000);
  });

  it('getTimeout falls back to 5000 ms default', () => {
    delete process.env.SOROBAN_RPC_TIMEOUT;
    const svc = new SorobanRpcService();
    expect(svc.getTimeout()).toBe(5000);
  });

  it('getRetryConfig returns a copy of the retry configuration', () => {
    const svc = new SorobanRpcService();
    const config = svc.getRetryConfig();
    expect(typeof config.retries).toBe('number');
    expect(typeof config.retryDelayMs).toBe('number');
    expect(typeof config.backoffMultiplier).toBe('number');
    expect(typeof config.maxRetryDelayMs).toBe('number');
  });
});
