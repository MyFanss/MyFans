/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { HealthController } from '../src/health/health.controller';
import { HealthService } from '../src/health/health.service';
import { DataSource } from 'typeorm';
import { SorobanRpcService } from '../src/common/services/soroban-rpc.service';
import { QueueMetricsService } from '../src/common/services/queue-metrics.service';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  const mockDataSource = { query: jest.fn().mockResolvedValue([1]) };
  const mockSorobanRpcService = {
    checkConnectivity: jest.fn().mockResolvedValue({ status: 'up' }),
    checkKnownContract: jest.fn().mockResolvedValue({ status: 'up' }),
  };
  const mockQueueMetrics = { snapshot: jest.fn().mockReturnValue({}) };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: SorobanRpcService, useValue: mockSorobanRpcService },
        { provide: QueueMetricsService, useValue: mockQueueMetrics },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /v1/health', () => {
    it('returns 200 with status up', () => {
      return request(app.getHttpServer())
        .get('/v1/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('up');
          expect(res.body.timestamp).toBeDefined();
        });
    });

    it('timestamp is a valid ISO string', () => {
      return request(app.getHttpServer())
        .get('/v1/health')
        .expect(200)
        .expect((res) => {
          expect(new Date(res.body.timestamp as string).toISOString()).toBe(
            res.body.timestamp,
          );
        });
    });
  });

  describe('GET /v1/health/checks', () => {
    it('returns paginated health checks with defaults', () => {
      return request(app.getHttpServer())
        .get('/v1/health/checks')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.total).toBeGreaterThan(0);
          expect(res.body.page).toBe(1);
          expect(res.body.limit).toBe(20);
        });
    });

    it('respects limit query param', () => {
      return request(app.getHttpServer())
        .get('/v1/health/checks?limit=2')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(2);
          expect(res.body.limit).toBe(2);
        });
    });

    it('respects page query param', () => {
      return request(app.getHttpServer())
        .get('/v1/health/checks?page=2&limit=2')
        .expect(200)
        .expect((res) => {
          expect(res.body.page).toBe(2);
        });
    });

    it('rejects limit > 100 with 400', () => {
      return request(app.getHttpServer())
        .get('/v1/health/checks?limit=999')
        .expect(400);
    });

    it('rejects page < 1 with 400', () => {
      return request(app.getHttpServer())
        .get('/v1/health/checks?page=0')
        .expect(400);
    });
  });
});
