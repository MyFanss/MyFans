import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppTestModule } from '../src/app-test.module';
import { AppService } from '../src/app.service';

describe('Health & readiness (e2e)', () => {
  let app: INestApplication;
  let checkReadiness: jest.Mock;

  beforeAll(async () => {
    checkReadiness = jest.fn();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule],
    })
      .overrideProvider(AppService)
      .useValue({ getHello: () => 'ok', checkReadiness })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    checkReadiness.mockReset();
  });

  describe('GET /v1/health', () => {
    it('returns 200 { status: ok } without touching dependencies', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/health')
        .expect(200);

      expect(res.body).toEqual({ status: 'ok' });
      expect(checkReadiness).not.toHaveBeenCalled();
    });
  });

  describe('GET /v1/ready', () => {
    it('returns 200 with status ok when all dependencies are up', async () => {
      checkReadiness.mockResolvedValue({
        status: 'ok',
        checks: {
          database: { status: 'up' },
          redis: { status: 'up' },
        },
      });

      const res = await request(app.getHttpServer())
        .get('/v1/ready')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.checks).toBeDefined();
      expect(checkReadiness).toHaveBeenCalledTimes(1);
    });

    it('returns 503 with status degraded and a down check with reason', async () => {
      checkReadiness.mockResolvedValue({
        status: 'degraded',
        checks: {
          database: { status: 'up' },
          redis: { status: 'down', reason: 'connection refused' },
        },
      });

      const res = await request(app.getHttpServer())
        .get('/v1/ready')
        .expect(503);

      expect(res.body.status).toBe('degraded');
      const downChecks = Object.values(res.body.checks).filter(
        (check: any) => check.status === 'down',
      );
      expect(downChecks.length).toBeGreaterThan(0);
      expect(downChecks[0]).toHaveProperty('reason');
      expect(checkReadiness).toHaveBeenCalledTimes(1);
    });
  });
});
