import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppTestModule } from './../src/app-test.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/v1 (GET) returns Hello World', () => {
    return request(app.getHttpServer())
      .get('/v1')
      .expect(200)
      .expect('Hello World!');
  });

  it('unversioned / (GET) returns 404 when versioning is enabled', () => {
    return request(app.getHttpServer()).get('/').expect(404);
  });

  it('error responses match the Nest filter envelope shape', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(404);

    expect(res.body).toEqual(
      expect.objectContaining({
        statusCode: 404,
        message: expect.any(String),
      }),
    );

    // correlationId is present when the filter attaches one; when present it
    // must be a non-empty string so clients can surface it on fatal toasts.
    if ('correlationId' in res.body) {
      expect(typeof res.body.correlationId).toBe('string');
      expect(res.body.correlationId.length).toBeGreaterThan(0);
    }

    // Raw server stacks / internal details must never leak to clients.
    expect(res.body).not.toHaveProperty('stack');
    expect(JSON.stringify(res.body)).not.toMatch(/\bat\s+\S+\s+\(/);
  });
});
