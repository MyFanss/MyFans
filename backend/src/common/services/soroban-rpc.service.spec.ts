import { Test, TestingModule } from '@nestjs/testing';
import { rpc } from '@stellar/stellar-sdk';
import { SorobanRpcService } from './soroban-rpc.service';

describe('SorobanRpcService', () => {
    let service: SorobanRpcService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [SorobanRpcService],
        }).compile();

        service = module.get<SorobanRpcService>(SorobanRpcService);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should return correct RPC URL', () => {
        expect(service.getRpcUrl()).toBe('https://soroban-testnet.stellar.org');
    });

    it('should return correct timeout', () => {
        expect(service.getTimeout()).toBe(5000);
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
        });
    });

    describe('environment configuration', () => {
        it('should use custom RPC URL from environment', () => {
            const originalRpcUrl = process.env.SOROBAN_RPC_URL;
            process.env.SOROBAN_RPC_URL = 'https://custom-rpc.example.com';

            const customService = new SorobanRpcService();
            expect(customService.getRpcUrl()).toBe('https://custom-rpc.example.com');

            process.env.SOROBAN_RPC_URL = originalRpcUrl;
        });

        it('should use custom timeout from environment', () => {
            const originalTimeout = process.env.SOROBAN_RPC_TIMEOUT;
            process.env.SOROBAN_RPC_TIMEOUT = '10000';

            const customService = new SorobanRpcService();
            expect(customService.getTimeout()).toBe(10000);

            process.env.SOROBAN_RPC_TIMEOUT = originalTimeout;
        });
    });
});
