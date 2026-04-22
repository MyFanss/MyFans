import { SorobanRpcService } from './soroban-rpc.service';

/** Replace the internal Stellar SDK server with a controllable stub. */
function makeService(stub: { ledgers?: () => any; loadAccount?: () => any } = {}) {
  const svc = new SorobanRpcService();
  // @ts-expect-error – accessing private field for test injection
  svc['server'] = {
    ledgers: stub.ledgers ?? (() => ({ order: () => ({ limit: () => ({ call: () => Promise.resolve({ records: [{ sequence: 100 }] }) }) }) })),
    loadAccount: stub.loadAccount ?? (() => Promise.resolve({})),
  };
  // @ts-expect-error
  svc['timeout'] = 200;
  // @ts-expect-error
  svc['retryConfig'] = { retries: 1, retryDelayMs: 0, backoffMultiplier: 1, maxRetryDelayMs: 0 };
  return svc;
}

describe('SorobanRpcService', () => {
  describe('checkConnectivity', () => {
    it('returns status=up when RPC responds in time', async () => {
      const svc = makeService();
      const result = await svc.checkConnectivity();
      expect(result.status).toBe('up');
      expect(result.responseTime).toBeDefined();
    });

    it('returns status=down and 503-worthy payload when RPC times out', async () => {
      const svc = makeService({
        ledgers: () => ({
          order: () => ({
            limit: () => ({
              call: () => new Promise((resolve) => setTimeout(resolve, 10_000)), // never resolves within timeout
            }),
          }),
        }),
      });
      // @ts-expect-error
      svc['timeout'] = 50;

      const result = await svc.checkConnectivity();
      expect(result.status).toBe('down');
      expect(result.error).toMatch(/timeout/i);
    });

    it('returns status=down when server is null (init failure)', async () => {
      const svc = new SorobanRpcService();
      // @ts-expect-error
      svc['server'] = null;
      const result = await svc.checkConnectivity();
      expect(result.status).toBe('down');
      expect(result.error).toMatch(/initialize/i);
    });

    it('returns status=down when RPC throws a network error', async () => {
      const svc = makeService({
        ledgers: () => ({
          order: () => ({
            limit: () => ({
              call: () => Promise.reject(new Error('ECONNREFUSED')),
            }),
          }),
        }),
      });
      const result = await svc.checkConnectivity();
      expect(result.status).toBe('down');
      expect(result.error).toContain('ECONNREFUSED');
    });
  });

  describe('checkKnownContract', () => {
    it('returns status=up when account load succeeds', async () => {
      const svc = makeService();
      const result = await svc.checkKnownContract();
      expect(result.status).toBe('up');
    });

    it('returns status=down when account load times out', async () => {
      const svc = makeService({
        loadAccount: () => new Promise((resolve) => setTimeout(resolve, 10_000)),
      });
      // @ts-expect-error
      svc['timeout'] = 50;

      const result = await svc.checkKnownContract();
      expect(result.status).toBe('down');
      expect(result.error).toMatch(/timeout/i);
    });

    it('returns status=down when server is null', async () => {
      const svc = new SorobanRpcService();
      // @ts-expect-error
      svc['server'] = null;
      const result = await svc.checkKnownContract();
      expect(result.status).toBe('down');
    });
  });

  describe('getters', () => {
    it('getRpcUrl returns the configured URL', () => {
      const svc = new SorobanRpcService();
      expect(typeof svc.getRpcUrl()).toBe('string');
    });

    it('getTimeout returns a positive number', () => {
      const svc = new SorobanRpcService();
      expect(svc.getTimeout()).toBeGreaterThan(0);
    });
  });
});
