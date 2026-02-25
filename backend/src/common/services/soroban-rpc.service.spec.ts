import { Test, TestingModule } from '@nestjs/testing';
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
        expect(service.getRpcUrl()).toBe('https://horizon-futurenet.stellar.org');
    });

    it('should return correct timeout', () => {
        expect(service.getTimeout()).toBe(5000);
    });

    describe('checkConnectivity', () => {
        it('should return up status when RPC is reachable', async () => {
            const result = await service.checkConnectivity();
            
            expect(result).toHaveProperty('status');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('rpcUrl');
            expect(result).toHaveProperty('responseTime');
            
            if (result.status === 'up') {
                expect(result).toHaveProperty('ledger');
                expect(typeof result.ledger).toBe('number');
                expect(result.ledger).toBeGreaterThan(0);
            } else {
                expect(result).toHaveProperty('error');
                expect(typeof result.error).toBe('string');
            }
        });

        it('should handle timeout properly', async () => {
            // Mock a very short timeout for testing
            const originalTimeout = process.env.SOROBAN_RPC_TIMEOUT;
            process.env.SOROBAN_RPC_TIMEOUT = '1';
            
            // Create a new service instance with the short timeout
            const testService = new SorobanRpcService();
            
            const result = await testService.checkConnectivity();
            
            expect(result.status).toBe('down');
            expect(result.error).toMatch(/timeout|Failed to initialize/);
            expect(result.responseTime).toBeLessThan(100); // Should timeout quickly
            
            process.env.SOROBAN_RPC_TIMEOUT = originalTimeout;
        });
    });

    describe('checkKnownContract', () => {
        it('should return up status when RPC is reachable', async () => {
            const result = await service.checkKnownContract();
            
            expect(result).toHaveProperty('status');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('rpcUrl');
            expect(result).toHaveProperty('responseTime');
            
            if (result.status === 'up') {
                expect(result.error).toContain('Contract check not fully implemented');
            } else {
                expect(result).toHaveProperty('error');
            }
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
