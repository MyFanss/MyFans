import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { applyAppConfig } from './../src/app.config';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyAppConfig(app);
    app.enableCors({
      origin: ['http://allowed-origin.com'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  describe('ValidationPipe', () => {
    it('returns 400 for invalid DTO (wrong types)', () => {
      return request(app.getHttpServer())
        .post('/validate-test')
        .send({ name: 123, age: 'invalid' })
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(Array.isArray(res.body.message)).toBe(true);
          expect(res.body.message.length).toBeGreaterThan(0);
        });
    });

    it('returns 400 for invalid DTO (extra non-whitelisted fields)', () => {
      return request(app.getHttpServer())
        .post('/validate-test')
        .send({ name: 'John', age: 25, extraField: 'not allowed' })
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          const messages = Array.isArray(res.body.message)
            ? res.body.message
            : [res.body.message];
          expect(messages.some((m: string) => m.includes('extraField'))).toBe(
            true,
          );
        });
    });

    it('returns 400 for invalid DTO (missing required fields)', () => {
      return request(app.getHttpServer())
        .post('/validate-test')
        .send({})
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(Array.isArray(res.body.message)).toBe(true);
        });
    });

    it('accepts valid DTO and returns 201', () => {
      return request(app.getHttpServer())
        .post('/validate-test')
        .send({ name: 'John', age: 25 })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('received');
          expect(res.body.received).toEqual({ name: 'John', age: 25 });
        });
    });
  });

  describe('CORS', () => {
    it('returns CORS headers when origin is allowed', () => {
      return request(app.getHttpServer())
        .get('/')
        .set('Origin', 'http://allowed-origin.com')
        .expect(200)
        .expect((res) => {
          expect(res.headers['access-control-allow-origin']).toBe(
            'http://allowed-origin.com',
          );
          expect(res.headers['access-control-allow-credentials']).toBe('true');
        });
    });

    it('rejects disallowed origins (no Access-Control-Allow-Origin header)', () => {
      return request(app.getHttpServer())
        .get('/')
        .set('Origin', 'http://disallowed-origin.com')
        .expect(200)
        .expect((res) => {
          expect(res.headers['access-control-allow-origin']).toBeUndefined();
        });
    });
  });
});
