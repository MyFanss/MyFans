import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { SorobanRpcService } from '../common/services/soroban-rpc.service';
import { QueueMetricsService } from '../common/services/queue-metrics.service';
import { DataSource } from 'typeorm';

describe('HealthService', () => {
    let service: HealthService;
    let mockDataSource: any;
    let mockSorobanRpcService: any;
    let mockQueueMetrics: any;

    beforeEach(async () => {
        mockDataSource = {
            query: jest.fn(),
        };

        mockSorobanRpcService = {
            checkConnectivity: jest.fn(),
            checkKnownContract: jest.fn(),
        };

        mockQueueMetrics = {
            snapshot: jest.fn().mockReturnValue({}),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                HealthService,
                { provide: DataSource, useValue: mockDataSource },
                { provide: SorobanRpcService, useValue: mockSorobanRpcService },
                { provide: QueueMetricsService, useValue: mockQueueMetrics },
            ],
        }).compile();

        service = module.get<HealthService>(HealthService);
    });

    describe('getHealth', () => {
        it('should return basic health status', () => {
            const result = service.getHealth();
            expect(result.status).toBe('ok');
            expect(result.timestamp).toBeDefined();
        });
    });

    describe('getDetailedHealth', () => {
        it('should return up when all checks pass', async () => {
            mockDataSource.query.mockResolvedValue([1]);
            mockSorobanRpcService.checkConnectivity.mockResolvedValue({
                status: 'up',
                timestamp: new Date().toISOString(),
            });
            mockSorobanRpcService.checkKnownContract.mockResolvedValue({
                status: 'up',
                timestamp: new Date().toISOString(),
            });

            const result = await service.getDetailedHealth();

            expect(result.status).toBe('up');
            expect(result.checks?.database?.status).toBe('up');
            expect(result.checks?.sorobanRpc?.status).toBe('up');
            expect(result.checks?.sorobanContract?.status).toBe('up');
        });

        it('should return down when database is down', async () => {
            mockDataSource.query.mockRejectedValue(new Error('Connection failed'));
            mockSorobanRpcService.checkConnectivity.mockResolvedValue({
                status: 'up',
            });
            mockSorobanRpcService.checkKnownContract.mockResolvedValue({
                status: 'up',
            });

            const result = await service.getDetailedHealth();

            expect(result.status).toBe('down');
            expect(result.checks?.database?.status).toBe('down');
        });

        it('should return down when Soroban RPC is down', async () => {
            mockDataSource.query.mockResolvedValue([1]);
            mockSorobanRpcService.checkConnectivity.mockResolvedValue({
                status: 'down',
                error: 'Connection timeout',
            });
            mockSorobanRpcService.checkKnownContract.mockResolvedValue({
                status: 'up',
            });

            const result = await service.getDetailedHealth();

            expect(result.status).toBe('down');
            expect(result.checks?.sorobanRpc?.status).toBe('down');
        });

        it('should return degraded when Soroban RPC is degraded', async () => {
            mockDataSource.query.mockResolvedValue([1]);
            mockSorobanRpcService.checkConnectivity.mockResolvedValue({
                status: 'degraded',
                error: '1 of 3 attempts failed',
            });
            mockSorobanRpcService.checkKnownContract.mockResolvedValue({
                status: 'up',
            });

            const result = await service.getDetailedHealth();

            expect(result.status).toBe('degraded');
            expect(result.checks?.sorobanRpc?.status).toBe('degraded');
        });

        it('should return degraded when contract check is degraded', async () => {
            mockDataSource.query.mockResolvedValue([1]);
            mockSorobanRpcService.checkConnectivity.mockResolvedValue({
                status: 'up',
            });
            mockSorobanRpcService.checkKnownContract.mockResolvedValue({
                status: 'degraded',
                error: 'Slow response times detected',
            });

            const result = await service.getDetailedHealth();

            expect(result.status).toBe('degraded');
            expect(result.checks?.sorobanContract?.status).toBe('degraded');
        });

        it('should return down when contract check is down', async () => {
            mockDataSource.query.mockResolvedValue([1]);
            mockSorobanRpcService.checkConnectivity.mockResolvedValue({
                status: 'up',
            });
            mockSorobanRpcService.checkKnownContract.mockResolvedValue({
                status: 'down',
                error: 'Contract read timeout',
            });

            const result = await service.getDetailedHealth();

            expect(result.status).toBe('down');
            expect(result.checks?.sorobanContract?.status).toBe('down');
        });

        it('should include details in response', async () => {
            mockDataSource.query.mockResolvedValue([1]);
            mockSorobanRpcService.checkConnectivity.mockResolvedValue({
                status: 'up',
                details: { attempts: 3, successCount: 3, failureCount: 0 },
            });
            mockSorobanRpcService.checkKnownContract.mockResolvedValue({
                status: 'up',
                details: { attempts: 3, successCount: 3, failureCount: 0 },
            });

            const result = await service.getDetailedHealth();

            expect(result.checks?.sorobanRpc?.details).toBeDefined();
            expect(result.checks?.sorobanContract?.details).toBeDefined();
        });
    });

    describe('checkDatabase', () => {
        it('should return up when query succeeds', async () => {
            mockDataSource.query.mockResolvedValue([1]);

            const result = await service.checkDatabase();

            expect(result.status).toBe('up');
        });

        it('should return down when query fails', async () => {
            mockDataSource.query.mockRejectedValue(new Error('Connection refused'));

            const result = await service.checkDatabase();

            expect(result.status).toBe('down');
            expect(result.error).toBe('Connection refused');
        });
    });

    describe('checkSorobanRpc', () => {
        it('should return health status from SorobanRpcService', async () => {
            const mockStatus = {
                status: 'up' as const,
                timestamp: new Date().toISOString(),
            };
            mockSorobanRpcService.checkConnectivity.mockResolvedValue(mockStatus);

            const result = await service.checkSorobanRpc();

            expect(result).toEqual(mockStatus);
            expect(mockSorobanRpcService.checkConnectivity).toHaveBeenCalled();
        });
    });

    describe('checkSorobanContract', () => {
        it('should return health status from SorobanRpcService', async () => {
            const mockStatus = {
                status: 'up' as const,
                timestamp: new Date().toISOString(),
            };
            mockSorobanRpcService.checkKnownContract.mockResolvedValue(mockStatus);

            const result = await service.checkSorobanContract();

            expect(result).toEqual(mockStatus);
            expect(mockSorobanRpcService.checkKnownContract).toHaveBeenCalled();
        });
    });

    describe('checkRedis', () => {
        it('should return down with message', async () => {
            const result = await service.checkRedis();
            expect(result.status).toBe('down');
            expect(result.error).toBe('Redis not configured');
        });
    });

    describe('getQueueMetrics', () => {
        it('should return queue metrics snapshot', () => {
            const mockSnapshot = { pending: 5, processed: 10 };
            mockQueueMetrics.snapshot.mockReturnValue(mockSnapshot);

            const result = service.getQueueMetrics();

            expect(result.timestamp).toBeDefined();
            expect(result.queues).toEqual(mockSnapshot);
        });
    });

    describe('getAggregatedHealth', () => {
        it('should return up when all subsystems are up', async () => {
            mockDataSource.query.mockResolvedValue([1]);
            mockSorobanRpcService.checkConnectivity.mockResolvedValue({ status: 'up', timestamp: new Date().toISOString() });
            mockSorobanRpcService.checkKnownContract.mockResolvedValue({ status: 'up', timestamp: new Date().toISOString() });

            const result = await service.getAggregatedHealth();

            expect(result.status).toBe('up');
            expect(result.summary.total).toBe(4);
            // database + sorobanRpc + sorobanContract are up; redis is down (not configured)
            expect(result.summary.up).toBe(3);
            expect(result.summary.down).toBe(1); // redis
            expect(result.subsystems.database.status).toBe('up');
            expect(result.subsystems.sorobanRpc.status).toBe('up');
            expect(result.subsystems.sorobanContract.status).toBe('up');
            expect(result.subsystems.redis.status).toBe('down');
        });

        it('should return down when database is down', async () => {
            mockDataSource.query.mockRejectedValue(new Error('DB unreachable'));
            mockSorobanRpcService.checkConnectivity.mockResolvedValue({ status: 'up', timestamp: new Date().toISOString() });
            mockSorobanRpcService.checkKnownContract.mockResolvedValue({ status: 'up', timestamp: new Date().toISOString() });

            const result = await service.getAggregatedHealth();

            expect(result.status).toBe('down');
            expect(result.subsystems.database.status).toBe('down');
            expect(result.subsystems.database.error).toBe('DB unreachable');
        });

        it('should return degraded when a non-database subsystem is down', async () => {
            mockDataSource.query.mockResolvedValue([1]);
            mockSorobanRpcService.checkConnectivity.mockResolvedValue({ status: 'down', timestamp: new Date().toISOString() });
            mockSorobanRpcService.checkKnownContract.mockResolvedValue({ status: 'up', timestamp: new Date().toISOString() });

            const result = await service.getAggregatedHealth();

            // sorobanRpc is down but DB is up → degraded (not fatal)
            expect(result.status).toBe('degraded');
            expect(result.subsystems.sorobanRpc.status).toBe('down');
        });

        it('should return degraded when any subsystem is degraded', async () => {
            mockDataSource.query.mockResolvedValue([1]);
            mockSorobanRpcService.checkConnectivity.mockResolvedValue({ status: 'degraded', timestamp: new Date().toISOString() });
            mockSorobanRpcService.checkKnownContract.mockResolvedValue({ status: 'up', timestamp: new Date().toISOString() });

            const result = await service.getAggregatedHealth();

            expect(result.status).toBe('degraded');
            expect(result.summary.degraded).toBe(1);
        });

        it('should include uptime as a non-negative integer', async () => {
            mockDataSource.query.mockResolvedValue([1]);
            mockSorobanRpcService.checkConnectivity.mockResolvedValue({ status: 'up', timestamp: new Date().toISOString() });
            mockSorobanRpcService.checkKnownContract.mockResolvedValue({ status: 'up', timestamp: new Date().toISOString() });

            const result = await service.getAggregatedHealth();

            expect(typeof result.uptime).toBe('number');
            expect(result.uptime).toBeGreaterThanOrEqual(0);
            expect(Number.isInteger(result.uptime)).toBe(true);
        });

        it('should include a valid ISO 8601 timestamp', async () => {
            mockDataSource.query.mockResolvedValue([1]);
            mockSorobanRpcService.checkConnectivity.mockResolvedValue({ status: 'up', timestamp: new Date().toISOString() });
            mockSorobanRpcService.checkKnownContract.mockResolvedValue({ status: 'up', timestamp: new Date().toISOString() });

            const result = await service.getAggregatedHealth();

            expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
            expect(() => new Date(result.timestamp)).not.toThrow();
        });

        it('should include database latencyMs when db is up', async () => {
            mockDataSource.query.mockResolvedValue([1]);
            mockSorobanRpcService.checkConnectivity.mockResolvedValue({ status: 'up', timestamp: new Date().toISOString() });
            mockSorobanRpcService.checkKnownContract.mockResolvedValue({ status: 'up', timestamp: new Date().toISOString() });

            const result = await service.getAggregatedHealth();

            expect(typeof result.subsystems.database.latencyMs).toBe('number');
            expect(result.subsystems.database.latencyMs).toBeGreaterThanOrEqual(0);
        });

        it('summary counts should add up to total', async () => {
            mockDataSource.query.mockResolvedValue([1]);
            mockSorobanRpcService.checkConnectivity.mockResolvedValue({ status: 'degraded', timestamp: new Date().toISOString() });
            mockSorobanRpcService.checkKnownContract.mockResolvedValue({ status: 'up', timestamp: new Date().toISOString() });

            const result = await service.getAggregatedHealth();

            const { total, up, degraded, down } = result.summary;
            expect(up + degraded + down).toBe(total);
        });
    });
});
