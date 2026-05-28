import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { SorobanRpcService } from '../common/services/soroban-rpc.service';
import { Response } from 'express';

describe('HealthController - Soroban RPC', () => {
    let controller: HealthController;
    let healthService: HealthService;
    let sorobanRpcService: SorobanRpcService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [HealthController],
            providers: [
                {
                    provide: HealthService,
                    useValue: {
                        getHealth: jest.fn(),
                        checkDatabase: jest.fn(),
                        checkRedis: jest.fn(),
                        checkSorobanRpc: jest.fn(),
                        checkSorobanContract: jest.fn(),
                    },
                },
                {
                    provide: SorobanRpcService,
                    useValue: {
                        checkConnectivity: jest.fn(),
                        checkKnownContract: jest.fn(),
                        getRpcUrl: jest.fn(),
                        getTimeout: jest.fn(),
                    },
                },
            ],
        }).compile();

        controller = module.get<HealthController>(HealthController);
        healthService = module.get<HealthService>(HealthService);
        sorobanRpcService = module.get<SorobanRpcService>(SorobanRpcService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getSorobanHealth', () => {
        it('should return 200 when Soroban RPC is up', async () => {
            const mockHealth = {
                status: 'up' as const,
                timestamp: '2024-01-01T00:00:00.000Z',
                rpcUrl: 'https://horizon-futurenet.stellar.org',
                ledger: 12345,
                responseTime: 150,
            };

            jest.spyOn(healthService, 'checkSorobanRpc').mockResolvedValue(mockHealth);

            const mockResponse = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            } as any;

            await controller.getSorobanHealth(mockResponse);

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith(mockHealth);
        });

        it('should return 503 when Soroban RPC is down', async () => {
            const mockHealth = {
                status: 'down' as const,
                timestamp: '2024-01-01T00:00:00.000Z',
                rpcUrl: 'https://horizon-futurenet.stellar.org',
                responseTime: 5000,
                error: 'RPC connection timeout',
            };

            jest.spyOn(healthService, 'checkSorobanRpc').mockResolvedValue(mockHealth);

            const mockResponse = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            } as any;

            await controller.getSorobanHealth(mockResponse);

            expect(mockResponse.status).toHaveBeenCalledWith(503);
            expect(mockResponse.json).toHaveBeenCalledWith(mockHealth);
        });
    });

    describe('getSorobanContractHealth', () => {
        it('should return 200 when Soroban contract check is up', async () => {
            const mockHealth = {
                status: 'up' as const,
                timestamp: '2024-01-01T00:00:00.000Z',
                rpcUrl: 'https://horizon-futurenet.stellar.org',
                responseTime: 200,
                error: 'Contract check not fully implemented - using ledger check as fallback',
            };

            jest.spyOn(healthService, 'checkSorobanContract').mockResolvedValue(mockHealth);

            const mockResponse = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            } as any;

            await controller.getSorobanContractHealth(mockResponse);

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith(mockHealth);
        });

        it('should return 503 when Soroban contract check is down', async () => {
            const mockHealth = {
                status: 'down' as const,
                timestamp: '2024-01-01T00:00:00.000Z',
                rpcUrl: 'https://horizon-futurenet.stellar.org',
                responseTime: 3000,
                error: 'Contract read timeout',
            };

            jest.spyOn(healthService, 'checkSorobanContract').mockResolvedValue(mockHealth);

            const mockResponse = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            } as any;

            await controller.getSorobanContractHealth(mockResponse);

            expect(mockResponse.status).toHaveBeenCalledWith(503);
            expect(mockResponse.json).toHaveBeenCalledWith(mockHealth);
        });
    });
});
