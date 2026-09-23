/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { CSRF_COOKIE, CSRF_HEADER } from '../src/common/middleware/csrf.middleware';

describe('CSRF Protection (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/csrf/token returns a CSRF cookie and token in body', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/csrf/token')
      .expect(200);

    expect(res.body.csrfToken).toBeDefined();
    expect(typeof res.body.csrfToken).toBe('string');

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();

    const csrfCookie = (Array.isArray(cookies) ? cookies : [cookies]).find(
      (c: string) => c.startsWith(CSRF_COOKIE + '='),
    );
    expect(csrfCookie).toBeDefined();
  });

  it('POST without CSRF token is rejected with 403', async () => {
    await request(app.getHttpServer())
      .post('/v1/posts')
      .send({ title: 'test' })
      .expect(403);
  });

  it('POST with valid CSRF token succeeds (not 403)', async () => {
    // First, obtain a CSRF token
    const tokenRes = await request(app.getHttpServer())
      .get('/v1/csrf/token')
      .expect(200);

    const csrfToken = tokenRes.body.csrfToken;
    const cookies = tokenRes.headers['set-cookie'];
    const cookieString = Array.isArray(cookies) ? cookies.join('; ') : cookies;

    // POST with the token — may get 401 (auth) but should NOT get 403 (CSRF)
    const res = await request(app.getHttpServer())
      .post('/v1/posts')
      .set('Cookie', cookieString)
      .set(CSRF_HEADER, csrfToken)
      .send({ title: 'test' });

    expect(res.status).not.toBe(403);
  });

  it('POST to webhook route succeeds without CSRF token (exempt)', async () => {
    // Webhook routes use HMAC auth, not CSRF. The request may fail on HMAC
    // verification (401/400) but should NOT be blocked by CSRF (403).
    const res = await request(app.getHttpServer())
      .post('/v1/webhook')
      .set('Content-Type', 'application/json')
      .send({ event: 'test' });

    expect(res.status).not.toBe(403);
  });

  it('Bearer-authenticated request bypasses CSRF', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/posts')
      .set('Authorization', 'Bearer fake-jwt-token')
      .send({ title: 'test' });

    // Should not get 403 — Bearer clients are exempt from CSRF
    expect(res.status).not.toBe(403);
  });
});
