import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
    let controller: HealthController;

    const mockHealthService = {
        getHealth: jest.fn(),
        getDetailedHealth: jest.fn(),
        getAggregatedHealth: jest.fn(),
        checkDatabase: jest.fn(),
        checkRedis: jest.fn(),
        checkSorobanRpc: jest.fn(),
        checkSorobanContract: jest.fn(),
        getQueueMetrics: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [HealthController],
            providers: [
                { provide: HealthService, useValue: mockHealthService },
            ],
        }).compile();

        controller = module.get<HealthController>(HealthController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getHealth', () => {
        it('returns the result from the service', () => {
            const health = { status: 'up', timestamp: new Date().toISOString() } as any;
            mockHealthService.getHealth.mockReturnValue(health);

            const result = controller.getHealth();

            expect(mockHealthService.getHealth).toHaveBeenCalled();
            expect(result).toBe(health);
        });

        it('returns status "up" with a valid ISO 8601 timestamp', () => {
            const ts = new Date().toISOString();
            mockHealthService.getHealth.mockReturnValue({ status: 'up', timestamp: ts });

            const result = controller.getHealth();

            expect(result.status).toBe('up');
            expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
            expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
        });
    });

    describe('getDetailedHealth', () => {
        it('returns 200 when status is up', async () => {
            const health = {
                status: 'up' as const,
                timestamp: new Date().toISOString(),
                checks: {
                    database: { status: 'up' },
                    sorobanRpc: { status: 'up' },
                    sorobanContract: { status: 'up' },
                },
            };
            mockHealthService.getDetailedHealth.mockResolvedValue(health);

            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
            await controller.getDetailedHealth(res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(health);
        });

        it('returns 503 when status is down', async () => {
            const health = {
                status: 'down' as const,
                timestamp: new Date().toISOString(),
                checks: {
                    database: { status: 'up' },
                    sorobanRpc: { status: 'down', error: 'Connection timeout' },
                    sorobanContract: { status: 'up' },
                },
            };
            mockHealthService.getDetailedHealth.mockResolvedValue(health);

            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
            await controller.getDetailedHealth(res);

            expect(res.status).toHaveBeenCalledWith(503);
            expect(res.json).toHaveBeenCalledWith(health);
        });

        it('returns 200 when status is degraded', async () => {
            const health = {
                status: 'degraded' as const,
                timestamp: new Date().toISOString(),
                checks: {
                    database: { status: 'up' },
                    sorobanRpc: { status: 'degraded', error: '1 of 3 attempts failed' },
                    sorobanContract: { status: 'up' },
                },
            };
            mockHealthService.getDetailedHealth.mockResolvedValue(health);

            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
            await controller.getDetailedHealth(res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(health);
        });
    });

    describe('getAggregatedHealth', () => {
        it('returns 200 when overall status is up', async () => {
            const health = {
                status: 'up' as const,
                timestamp: new Date().toISOString(),
                uptime: 120,
                version: '0.0.1',
                subsystems: {
                    database: { status: 'up' as const, latencyMs: 5 },
                    redis: { status: 'up' as const, latencyMs: 2 },
                    sorobanRpc: { status: 'up' as const, timestamp: new Date().toISOString() },
                    sorobanContract: { status: 'up' as const, timestamp: new Date().toISOString() },
                },
                summary: { total: 4, up: 4, degraded: 0, down: 0 },
            };
            mockHealthService.getAggregatedHealth.mockResolvedValue(health);

            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
            await controller.getAggregatedHealth(res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(health);
        });

        it('returns 200 when overall status is degraded', async () => {
            const health = {
                status: 'degraded' as const,
                timestamp: new Date().toISOString(),
                uptime: 60,
                version: '0.0.1',
                subsystems: {
                    database: { status: 'up' as const, latencyMs: 5 },
                    redis: { status: 'up' as const, latencyMs: 2 },
                    sorobanRpc: { status: 'degraded' as const, timestamp: new Date().toISOString() },
                    sorobanContract: { status: 'up' as const, timestamp: new Date().toISOString() },
                },
                summary: { total: 4, up: 3, degraded: 1, down: 0 },
            };
            mockHealthService.getAggregatedHealth.mockResolvedValue(health);

            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
            await controller.getAggregatedHealth(res);

            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('returns 503 when overall status is down', async () => {
            const health = {
                status: 'down' as const,
                timestamp: new Date().toISOString(),
                uptime: 10,
                version: '0.0.1',
                subsystems: {
                    database: { status: 'down' as const, latencyMs: 0, error: 'DB unreachable' },
                    redis: { status: 'up' as const, latencyMs: 2 },
                    sorobanRpc: { status: 'up' as const, timestamp: new Date().toISOString() },
                    sorobanContract: { status: 'up' as const, timestamp: new Date().toISOString() },
                },
                summary: { total: 4, up: 3, degraded: 0, down: 1 },
            };
            mockHealthService.getAggregatedHealth.mockResolvedValue(health);

            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
            await controller.getAggregatedHealth(res);

            expect(res.status).toHaveBeenCalledWith(503);
        });
    });

    describe('getDbHealth', () => {
        it('returns 200 when database is up', async () => {
            mockHealthService.checkDatabase.mockResolvedValue({ status: 'up' });

            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
            await controller.getDbHealth(res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ status: 'up' });
        });

        it('returns 503 when database is down', async () => {
            mockHealthService.checkDatabase.mockResolvedValue({ status: 'down', error: 'Connection failed' });

            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
            await controller.getDbHealth(res);

            expect(res.status).toHaveBeenCalledWith(503);
            expect(res.json).toHaveBeenCalledWith({ status: 'down', error: 'Connection failed' });
        });

        it('returns 200 when database is degraded', async () => {
            mockHealthService.checkDatabase.mockResolvedValue({ status: 'degraded', error: 'High latency' });

            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
            await controller.getDbHealth(res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ status: 'degraded', error: 'High latency' });
        });
    });

    describe('getRedisHealth', () => {
        it('returns 200 when Redis is not configured (optional subsystem)', async () => {
            mockHealthService.checkRedis.mockResolvedValue({ status: 'not_configured' });

            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
            await controller.getRedisHealth(res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ status: 'not_configured' });
        });

        it('returns 200 with latency when Redis is up', async () => {
            mockHealthService.checkRedis.mockResolvedValue({ status: 'up', latencyMs: 3 });

            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
            await controller.getRedisHealth(res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ status: 'up', latencyMs: 3 });
        });

        it('returns 503 when a configured Redis is down', async () => {
            mockHealthService.checkRedis.mockResolvedValue({ status: 'down', error: 'connect ECONNREFUSED' });

            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
            await controller.getRedisHealth(res);

            expect(res.status).toHaveBeenCalledWith(503);
            expect(res.json).toHaveBeenCalledWith({ status: 'down', error: 'connect ECONNREFUSED' });
        });
    });

    describe('getSorobanHealth', () => {
        it('returns 200 when Soroban RPC is up', async () => {
            mockHealthService.checkSorobanRpc.mockResolvedValue({
                status: 'up' as const,
                timestamp: new Date().toISOString(),
                rpcUrl: 'https://horizon-futurenet.stellar.org',
                ledger: 12345,
                responseTime: 150,
            });

            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
            await controller.getSorobanHealth(res);

            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('returns 503 when Soroban RPC is down', async () => {
            mockHealthService.checkSorobanRpc.mockResolvedValue({
                status: 'down' as const,
                timestamp: new Date().toISOString(),
                error: 'Connection timeout',
            });

            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
            await controller.getSorobanHealth(res);

            expect(res.status).toHaveBeenCalledWith(503);
        });

        it('returns 200 when Soroban RPC is degraded', async () => {
            mockHealthService.checkSorobanRpc.mockResolvedValue({
                status: 'degraded' as const,
                timestamp: new Date().toISOString(),
                error: '1 of 3 attempts failed',
                details: { attempts: 3, successCount: 2, failureCount: 1, lastError: 'Connection refused' },
            });

            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
            await controller.getSorobanHealth(res);

            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe('getSorobanContractHealth', () => {
        it('returns 200 when contract check is up', async () => {
            mockHealthService.checkSorobanContract.mockResolvedValue({
                status: 'up' as const,
                timestamp: new Date().toISOString(),
            });

            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
            await controller.getSorobanContractHealth(res);

            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('returns 503 when contract check is down', async () => {
            mockHealthService.checkSorobanContract.mockResolvedValue({
                status: 'down' as const,
                timestamp: new Date().toISOString(),
                error: 'Contract read timeout',
            });

            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
            await controller.getSorobanContractHealth(res);

            expect(res.status).toHaveBeenCalledWith(503);
        });

        it('returns 200 when contract check is degraded', async () => {
            mockHealthService.checkSorobanContract.mockResolvedValue({
                status: 'degraded' as const,
                timestamp: new Date().toISOString(),
                error: 'Slow response times detected',
                details: { attempts: 3, successCount: 3, failureCount: 0, slowResponses: 2, avgResponseTime: 4000 },
            });

            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
            await controller.getSorobanContractHealth(res);

            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe('getQueueMetrics', () => {
        it('returns queue metrics from the service', () => {
            const metrics = { timestamp: '2024-01-01T00:00:00.000Z', queues: {} };
            mockHealthService.getQueueMetrics.mockReturnValue(metrics);

            const result = controller.getQueueMetrics();

            expect(mockHealthService.getQueueMetrics).toHaveBeenCalled();
            expect(result).toBe(metrics);
        });
    });
});
