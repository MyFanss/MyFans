import { Test, TestingModule } from '@nestjs/testing';
import { rpc } from '@stellar/stellar-sdk';
import { SorobanRpcService, SorobanHealthStatus, RetryConfig } from './soroban-rpc.service';

// Mock the Stellar SDK
jest.mock('@stellar/stellar-sdk', () => ({
    Horizon: {
        Server: jest.fn().mockImplementation(() => ({
            ledgers: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            call: jest.fn(),
            loadAccount: jest.fn(),
        })),
    },
}));

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

    it('should return correct RPC URL', () => {
        expect(service.getRpcUrl()).toBe('https://soroban-testnet.stellar.org');
    });
    describe('checkConnectivity', () => {
        it('should return up status on successful connection', async () => {
            mockServer.ledgers().order('desc').limit(1).call = jest.fn().mockResolvedValue({
                records: [{ sequence: 12345 }],
            });

            const result = await service.checkConnectivity();

            expect(result.status).toBe('up');
            expect(result.ledger).toBe(12345);
            expect(result.rpcUrl).toBeDefined();
            expect(result.details).toBeDefined();
            expect(result.details?.attempts).toBeGreaterThanOrEqual(1);
        });

        it('should return down status when server is not initialized', async () => {
            // Create service with invalid server
            const badService = new SorobanRpcService();
            (badService as any).server = null;

            const result = await badService.checkConnectivity();

            expect(result.status).toBe('down');
            expect(result.error).toContain('Failed to initialize');
            expect(result.details?.failureCount).toBe(1);
        });

        it('should retry on failure and succeed on retry', async () => {
            let callCount = 0;
            mockServer.ledgers().order('desc').limit(1).call = jest.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.reject(new Error('Connection refused'));
                }
                return Promise.resolve({ records: [{ sequence: 12345 }] });
            });

    describe('checkConnectivity', () => {
        it('should return up status when RPC is reachable', async () => {
            jest.spyOn(rpc.Server.prototype, 'getHealth').mockResolvedValue({
                status: 'healthy',
                ledger: 12345,
            } as any);

            const result = await service.checkConnectivity();

            expect(result.status).toBe('up');
            expect(result.rpcUrl).toBe('https://soroban-testnet.stellar.org');
            expect(result.ledger).toBe(12345);
            expect(typeof result.responseTime).toBe('number');
        });

        it('should return down status when RPC throws', async () => {
            jest.spyOn(rpc.Server.prototype, 'getHealth').mockRejectedValue(new Error('connection refused'));
            const result = await service.checkConnectivity();

            // Status is 'degraded' because retries were needed (not fully reliable)
            expect(result.status).toBe('degraded');
            expect(callCount).toBe(2);
            expect(result.details?.successCount).toBe(1);
            expect(result.details?.failureCount).toBe(1);
        });

        it('should return down after all retries fail', async () => {
            mockServer.ledgers().order('desc').limit(1).call = jest.fn().mockRejectedValue(
                new Error('Connection timeout')
            );

            const result = await service.checkConnectivity();

            expect(result.status).toBe('down');
            expect(result.error).toBe('connection refused');
        });

        it('should handle timeout', async () => {
            const originalTimeout = process.env.SOROBAN_RPC_TIMEOUT;
            process.env.SOROBAN_RPC_TIMEOUT = '1';

            const testService = new SorobanRpcService();
            jest.spyOn(rpc.Server.prototype, 'getHealth').mockImplementation(
                () => new Promise((resolve) => setTimeout(resolve, 500)),
            );

            const result = await testService.checkConnectivity();

            expect(result.status).toBe('down');
            expect(result.error).toMatch(/timeout/);

            process.env.SOROBAN_RPC_TIMEOUT = originalTimeout;
            expect(result.error).toContain('Connection timeout');
            expect(result.details?.attempts).toBe(3);
            expect(result.details?.failureCount).toBe(3);
            expect(result.details?.successCount).toBe(0);
        });

        it('should return degraded when some retries succeed after failures', async () => {
            let callCount = 0;
            mockServer.ledgers().order('desc').limit(1).call = jest.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.reject(new Error('Connection refused'));
                }
                return Promise.resolve({ records: [{ sequence: 12345 }] });
            });

            const result = await service.checkConnectivity();

            expect(result.status).toBe('degraded');
            expect(result.error).toContain('1 of 3 attempts failed');
            // Early exit on success after retry: 1 fails, 1 succeeds
            expect(result.details?.successCount).toBe(1);
            expect(result.details?.failureCount).toBe(1);
        });

        it('should return degraded when responses are slow', async () => {
            // Set a very short timeout to trigger slow responses
            process.env.SOROBAN_RPC_TIMEOUT = '1';
            
            let callCount = 0;
            mockServer.ledgers().order('desc').limit(1).call = jest.fn().mockImplementation(async () => {
                callCount++;
                // Each call takes 100ms which exceeds 1ms timeout
                await new Promise(resolve => setTimeout(resolve, 100));
                return Promise.resolve({ records: [{ sequence: 12345 }] });
            });

            const result = await new SorobanRpcService().checkConnectivity();

            // With 1ms timeout and 100ms delay, all should fail or be slow
            expect(['degraded', 'down']).toContain(result.status);
        });

        it('should include retry details in response', async () => {
            mockServer.ledgers().order('desc').limit(1).call = jest.fn().mockResolvedValue({
                records: [{ sequence: 12345 }],
            });

            const result = await service.checkConnectivity();

            expect(result.details).toBeDefined();
            expect(result.details?.avgResponseTime).toBeDefined();
            expect(typeof result.details?.avgResponseTime).toBe('number');
        });

        it('should handle abort signal timeout', async () => {
            mockServer.ledgers().order('desc').limit(1).call = jest.fn().mockImplementation(
                () => new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('RPC connection timeout')), 100)
                )
            );

            const result = await service.checkConnectivity();

            expect(result.status).toBe('down');
            expect(result.error).toContain('timeout');
        });
    });

    describe('checkKnownContract', () => {
        it('should return down when SOROBAN_HEALTH_CHECK_CONTRACT is not set', async () => {
            const original = process.env.SOROBAN_HEALTH_CHECK_CONTRACT;
            delete process.env.SOROBAN_HEALTH_CHECK_CONTRACT;

            const result = await service.checkKnownContract();

            expect(result.status).toBe('down');
            expect(result.error).toContain('SOROBAN_HEALTH_CHECK_CONTRACT not configured');

            process.env.SOROBAN_HEALTH_CHECK_CONTRACT = original;
        it('should return up status on successful contract check', async () => {
            mockServer.loadAccount = jest.fn().mockResolvedValue({
                accountId: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            });

            const result = await service.checkKnownContract();

            expect(result.status).toBe('up');
            expect(result.rpcUrl).toBeDefined();
        });

        it('should retry on failure and succeed on retry', async () => {
            let callCount = 0;
            mockServer.loadAccount = jest.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.reject(new Error('Network error'));
                }
                return Promise.resolve({ accountId: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' });
            });

            const result = await service.checkKnownContract();

            // Status is 'degraded' because retries were needed (not fully reliable)
            expect(result.status).toBe('degraded');
            expect(callCount).toBe(2);
        });

        it('should return down after all retries fail', async () => {
            mockServer.loadAccount = jest.fn().mockRejectedValue(
                new Error('Contract read timeout')
            );

            const result = await service.checkKnownContract();

            expect(result.status).toBe('down');
            expect(result.error).toContain('Contract read timeout');
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

    describe('getRpcUrl', () => {
        it('should return the configured RPC URL', () => {
            expect(service.getRpcUrl()).toBeDefined();
        });

        it('should use environment variable if set', () => {
            process.env.SOROBAN_RPC_URL = 'https://custom-rpc.example.com';

            const customService = new SorobanRpcService();
            expect(customService.getRpcUrl()).toBe('https://custom-rpc.example.com');

            process.env.SOROBAN_RPC_URL = originalRpcUrl;
            const customService = new SorobanRpcService();
            expect(customService.getRpcUrl()).toBe('https://custom-rpc.example.com');
        });
    });
  });

  describe('getters', () => {
    it('getRpcUrl returns the configured URL', () => {
      const svc = new SorobanRpcService();
      expect(typeof svc.getRpcUrl()).toBe('string');
    });

        it('should use environment variable if set', () => {
            process.env.SOROBAN_RPC_TIMEOUT = '10000';

            const customService = new SorobanRpcService();
            expect(customService.getTimeout()).toBe(10000);

            process.env.SOROBAN_RPC_TIMEOUT = originalTimeout;
            const customService = new SorobanRpcService();
            expect(customService.getTimeout()).toBe(10000);
        });
    });
  });
});
