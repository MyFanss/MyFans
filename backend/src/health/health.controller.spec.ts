import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { DataSource } from 'typeorm';
import { SorobanRpcService } from '../common/services/soroban-rpc.service';

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
});
