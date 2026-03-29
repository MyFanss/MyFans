import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { applyAppConfig } from './../src/app.config';

describe('Versioning (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyAppConfig(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('unversioned /health/db should return 200 with Deprecation headers', async () => {
    return request(app.getHttpServer())
      .get('/health/db')
      .expect(200)
      .expect((res) => {
        expect(res.headers['deprecation']).toBe('true');
        expect(res.headers['warning']).toContain('deprecated');
      });
  });

  it('v1 /v1/health/db should return 200 without Deprecation headers', async () => {
    return request(app.getHttpServer())
      .get('/v1/health/db')
      .expect(200)
      .expect((res) => {
        expect(res.headers['deprecation']).toBeUndefined();
      });
  });
});
