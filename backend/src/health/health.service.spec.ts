import { Test, TestingModule } from '@nestjs/testing';
import * as net from 'net';
import { HealthService } from './health.service';
import { SorobanRpcService } from '../common/services/soroban-rpc.service';
import { QueueMetricsService } from '../common/services/queue-metrics.service';
import { DataSource } from 'typeorm';

describe('HealthService', () => {
    let service: HealthService;
    let mockDataSource: any;
    let mockSorobanRpcService: any;
    let mockQueueMetrics: any;

    const REDIS_ENV_KEYS = ['REDIS_URL', 'REDIS_HOST', 'REDIS_PORT'];
    let savedRedisEnv: Record<string, string | undefined>;

    beforeEach(async () => {
        // Isolate the Redis probe from the runner's environment so tests are
        // deterministic. Individual tests opt in by setting REDIS_URL.
        savedRedisEnv = {};
        for (const key of REDIS_ENV_KEYS) {
            savedRedisEnv[key] = process.env[key];
            delete process.env[key];
        }

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

    afterEach(() => {
        for (const key of REDIS_ENV_KEYS) {
            if (savedRedisEnv[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = savedRedisEnv[key];
            }
        }
    });

    describe('getHealth', () => {
        it('should return basic health status', () => {
            const result = service.getHealth();
            expect(result.status).toBe('up');
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
        it('returns not_configured when no Redis env is set', async () => {
            const pingSpy = jest.spyOn(service as any, 'pingRedis');

            const result = await service.checkRedis();

            expect(result.status).toBe('not_configured');
            expect(result.error).toBeUndefined();
            // No socket should be opened when Redis is unconfigured.
            expect(pingSpy).not.toHaveBeenCalled();
        });

        it('returns up with latency when PING succeeds', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379';
            const pingSpy = jest
                .spyOn(service as any, 'pingRedis')
                .mockResolvedValue(undefined);

            const result = await service.checkRedis();

            expect(result.status).toBe('up');
            expect(typeof result.latencyMs).toBe('number');
            expect(result.latencyMs).toBeGreaterThanOrEqual(0);
            expect(pingSpy).toHaveBeenCalledWith('redis://localhost:6379', expect.any(Number));
        });

        it('returns down with the error when the connection fails', async () => {
            process.env.REDIS_URL = 'redis://bad-host:6379';
            jest
                .spyOn(service as any, 'pingRedis')
                .mockRejectedValue(new Error('connect ECONNREFUSED'));

            const result = await service.checkRedis();

            expect(result.status).toBe('down');
            expect(result.error).toBe('connect ECONNREFUSED');
            expect(typeof result.latencyMs).toBe('number');
        });

        it('returns down when PING replies with an unexpected value', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379';
            jest
                .spyOn(service as any, 'pingRedis')
                .mockRejectedValue(new Error('Unexpected PING reply: NOPE'));

            const result = await service.checkRedis();

            expect(result.status).toBe('down');
            expect(result.error).toContain('NOPE');
        });

        it('builds a URL from REDIS_HOST / REDIS_PORT when REDIS_URL is absent', async () => {
            process.env.REDIS_HOST = 'cache.internal';
            process.env.REDIS_PORT = '6380';
            const pingSpy = jest
                .spyOn(service as any, 'pingRedis')
                .mockResolvedValue(undefined);

            await service.checkRedis();

            expect(pingSpy).toHaveBeenCalledWith('redis://cache.internal:6380', expect.any(Number));
        });
    });

    describe('pingRedis (against a fake RESP server)', () => {
        const servers: net.Server[] = [];
        const openSockets: net.Socket[] = [];

        const startServer = (handler: (socket: net.Socket) => void): Promise<number> =>
            new Promise((resolve) => {
                const server = net.createServer((socket) => {
                    openSockets.push(socket);
                    handler(socket);
                });
                servers.push(server);
                server.listen(0, '127.0.0.1', () => {
                    resolve((server.address() as net.AddressInfo).port);
                });
            });

        afterEach(async () => {
            // Force-close any lingering server-side sockets (e.g. the silent
            // timeout server) so server.close() can resolve.
            for (const s of openSockets) s.destroy();
            openSockets.length = 0;
            await Promise.all(
                servers.map((s) => new Promise<void>((r) => s.close(() => r()))),
            );
            servers.length = 0;
        });

        it('reports up when the server replies +PONG', async () => {
            const port = await startServer((socket) => {
                socket.on('data', () => socket.write('+PONG\r\n'));
            });
            process.env.REDIS_URL = `redis://127.0.0.1:${port}`;

            const result = await service.checkRedis();

            expect(result.status).toBe('up');
            expect(result.latencyMs).toBeGreaterThanOrEqual(0);
        });

        it('sends AUTH before PING when the URL carries a password', async () => {
            const received: string[] = [];
            const port = await startServer((socket) => {
                socket.on('data', (buf) => {
                    const msg = buf.toString();
                    received.push(msg.trim());
                    if (msg.startsWith('AUTH')) socket.write('+OK\r\n');
                    else if (msg.startsWith('PING')) socket.write('+PONG\r\n');
                });
            });
            process.env.REDIS_URL = `redis://:s3cr3t@127.0.0.1:${port}`;

            const result = await service.checkRedis();

            expect(result.status).toBe('up');
            expect(received[0]).toContain('AUTH');
            expect(received[0]).toContain('s3cr3t');
            expect(received.some((m) => m.includes('PING'))).toBe(true);
        });

        it('reports down with the RESP error when the server rejects', async () => {
            const port = await startServer((socket) => {
                socket.on('data', () => socket.write('-NOAUTH Authentication required\r\n'));
            });
            process.env.REDIS_URL = `redis://127.0.0.1:${port}`;

            const result = await service.checkRedis();

            expect(result.status).toBe('down');
            expect(result.error).toContain('NOAUTH');
        });

        it('reports down on an unexpected reply', async () => {
            const port = await startServer((socket) => {
                socket.on('data', () => socket.write('+WAT\r\n'));
            });
            process.env.REDIS_URL = `redis://127.0.0.1:${port}`;

            const result = await service.checkRedis();

            expect(result.status).toBe('down');
            expect(result.error).toContain('WAT');
        });

        it('rejects when the server never replies (timeout)', async () => {
            const port = await startServer(() => {
                // Accept the connection but stay silent.
            });

            await expect(
                (service as any).pingRedis(`redis://127.0.0.1:${port}`, 80),
            ).rejects.toThrow(/timed out/);
        });

        it('rejects an invalid URL without opening a socket', async () => {
            await expect(
                (service as any).pingRedis('not-a-valid-url', 100),
            ).rejects.toThrow(/Invalid Redis URL/);
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
        it('should return up when all subsystems are up and Redis is unconfigured', async () => {
            mockDataSource.query.mockResolvedValue([1]);
            mockSorobanRpcService.checkConnectivity.mockResolvedValue({ status: 'up', timestamp: new Date().toISOString() });
            mockSorobanRpcService.checkKnownContract.mockResolvedValue({ status: 'up', timestamp: new Date().toISOString() });

            const result = await service.getAggregatedHealth();

            // Redis unconfigured is skipped entirely, so it neither counts nor
            // degrades the aggregate.
            expect(result.status).toBe('up');
            expect(result.summary.total).toBe(3);
            expect(result.summary.up).toBe(3);
            expect(result.summary.down).toBe(0);
            expect(result.subsystems.database.status).toBe('up');
            expect(result.subsystems.sorobanRpc.status).toBe('up');
            expect(result.subsystems.sorobanContract.status).toBe('up');
            expect(result.subsystems.redis).toBeUndefined();
        });

        it('includes Redis in the summary when it is configured and up', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379';
            jest.spyOn(service as any, 'pingRedis').mockResolvedValue(undefined);
            mockDataSource.query.mockResolvedValue([1]);
            mockSorobanRpcService.checkConnectivity.mockResolvedValue({ status: 'up', timestamp: new Date().toISOString() });
            mockSorobanRpcService.checkKnownContract.mockResolvedValue({ status: 'up', timestamp: new Date().toISOString() });

            const result = await service.getAggregatedHealth();

            expect(result.status).toBe('up');
            expect(result.summary.total).toBe(4);
            expect(result.summary.up).toBe(4);
            expect(result.subsystems.redis?.status).toBe('up');
        });

        it('degrades the aggregate when configured Redis is down', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379';
            jest
                .spyOn(service as any, 'pingRedis')
                .mockRejectedValue(new Error('connect ECONNREFUSED'));
            mockDataSource.query.mockResolvedValue([1]);
            mockSorobanRpcService.checkConnectivity.mockResolvedValue({ status: 'up', timestamp: new Date().toISOString() });
            mockSorobanRpcService.checkKnownContract.mockResolvedValue({ status: 'up', timestamp: new Date().toISOString() });

            const result = await service.getAggregatedHealth();

            // DB is up, so a down Redis degrades rather than takes the service down.
            expect(result.status).toBe('degraded');
            expect(result.summary.total).toBe(4);
            expect(result.summary.down).toBe(1);
            expect(result.subsystems.redis?.status).toBe('down');
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
