import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { DataSource } from 'typeorm';
import { SorobanRpcService } from '../common/services/soroban-rpc.service';
import { QueueMetricsService } from '../common/services/queue-metrics.service';

describe('HealthController', () => {
    let controller: HealthController;
    let service: HealthService;

    const mockDataSource = {
        query: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [HealthController],
            providers: [
                HealthService,
                {
                    provide: DataSource,
                    useValue: mockDataSource,
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
                {
                    provide: QueueMetricsService,
                    useValue: { snapshot: jest.fn().mockReturnValue({}) },
                },
            ],
        }).compile();

        controller = module.get<HealthController>(HealthController);
        service = module.get<HealthService>(HealthService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getHealth', () => {
        it('should return health status', () => {
            const result = controller.getHealth();
            expect(result.status).toBe('ok');
            expect(result.timestamp).toBeDefined();
        });
    });

    describe('getDetailedHealth', () => {
        it('should return 200 when all checks are up', async () => {
            const mockHealth = {
                status: 'up' as const,
                timestamp: new Date().toISOString(),
                checks: {
                    database: { status: 'up' },
                    sorobanRpc: { status: 'up' },
                    sorobanContract: { status: 'up' },
                },
            };
            jest.spyOn(service, 'getDetailedHealth').mockResolvedValue(mockHealth);

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            } as any;

            await controller.getDetailedHealth(res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(mockHealth);
        });

        it('should return 503 when overall status is down', async () => {
            const mockHealth = {
                status: 'down' as const,
                timestamp: new Date().toISOString(),
                checks: {
                    database: { status: 'up' },
                    sorobanRpc: { status: 'down', error: 'Connection timeout' },
                    sorobanContract: { status: 'up' },
                },
            };
            jest.spyOn(service, 'getDetailedHealth').mockResolvedValue(mockHealth);

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            } as any;

            await controller.getDetailedHealth(res);

            expect(res.status).toHaveBeenCalledWith(503);
            expect(res.json).toHaveBeenCalledWith(mockHealth);
        });

        it('should return 200 when status is degraded', async () => {
            const mockHealth = {
                status: 'degraded' as const,
                timestamp: new Date().toISOString(),
                checks: {
                    database: { status: 'up' },
                    sorobanRpc: { status: 'degraded', error: '1 of 3 attempts failed' },
                    sorobanContract: { status: 'up' },
                },
            };
            jest.spyOn(service, 'getDetailedHealth').mockResolvedValue(mockHealth);

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            } as any;

            await controller.getDetailedHealth(res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(mockHealth);
        });
    });

    describe('getDbHealth', () => {
        it('should return up when DB is connected', async () => {
            mockDataSource.query.mockResolvedValue([1]);
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis(),
            } as any;

            await controller.getDbHealth(res);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ status: 'up' });
        });

        it('should return 503 when DB query fails', async () => {
            mockDataSource.query.mockRejectedValue(new Error('Connection failed'));
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis(),
            } as any;

            await controller.getDbHealth(res);
            expect(res.status).toHaveBeenCalledWith(503);
            expect(res.json).toHaveBeenCalledWith({
                status: 'down',
                error: 'Connection failed',
            });
        });
    });

    describe('getRedisHealth', () => {
        it('should return 503 as Redis is not configured', async () => {
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis(),
            } as any;

            await controller.getRedisHealth(res);
            expect(res.status).toHaveBeenCalledWith(503);
            expect(res.json).toHaveBeenCalledWith({
                status: 'down',
                message: 'Redis not configured',
            });
        });
    });

    describe('getSorobanHealth', () => {
        it('should return 200 when Soroban RPC is up', async () => {
            jest.spyOn(service, 'checkSorobanRpc').mockResolvedValue({
                status: 'up' as const,
                timestamp: new Date().toISOString(),
                rpcUrl: 'https://horizon-futurenet.stellar.org',
                ledger: 12345,
                responseTime: 150,
            });

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            } as any;

            await controller.getSorobanHealth(res);

            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('should return 503 when Soroban RPC is down', async () => {
            jest.spyOn(service, 'checkSorobanRpc').mockResolvedValue({
                status: 'down' as const,
                timestamp: new Date().toISOString(),
                error: 'Connection timeout',
            });

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            } as any;

            await controller.getSorobanHealth(res);

            expect(res.status).toHaveBeenCalledWith(503);
        });

        it('should return 200 when Soroban RPC is degraded', async () => {
            jest.spyOn(service, 'checkSorobanRpc').mockResolvedValue({
                status: 'degraded' as const,
                timestamp: new Date().toISOString(),
                error: '1 of 3 attempts failed',
                details: {
                    attempts: 3,
                    successCount: 2,
                    failureCount: 1,
                    lastError: 'Connection refused',
                },
            });

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            } as any;

            await controller.getSorobanHealth(res);

            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe('getSorobanContractHealth', () => {
        it('should return 200 when contract check is up', async () => {
            jest.spyOn(service, 'checkSorobanContract').mockResolvedValue({
                status: 'up' as const,
                timestamp: new Date().toISOString(),
            });

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            } as any;

            await controller.getSorobanContractHealth(res);

            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('should return 503 when contract check is down', async () => {
            jest.spyOn(service, 'checkSorobanContract').mockResolvedValue({
                status: 'down' as const,
                timestamp: new Date().toISOString(),
                error: 'Contract read timeout',
            });

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            } as any;

            await controller.getSorobanContractHealth(res);

            expect(res.status).toHaveBeenCalledWith(503);
        });

        it('should return 200 when contract check is degraded', async () => {
            jest.spyOn(service, 'checkSorobanContract').mockResolvedValue({
                status: 'degraded' as const,
                timestamp: new Date().toISOString(),
                error: 'Slow response times detected',
                details: {
                    attempts: 3,
                    successCount: 3,
                    failureCount: 0,
                    slowResponses: 2,
                    avgResponseTime: 4000,
                },
            });

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            } as any;

            await controller.getSorobanContractHealth(res);

            expect(res.status).toHaveBeenCalledWith(200);
        });
    });
});
