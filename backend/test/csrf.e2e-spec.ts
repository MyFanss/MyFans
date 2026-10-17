import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  CSRF_COOKIE,
  CSRF_HEADER,
} from '../src/common/middleware/csrf.middleware';

describe('CSRF protection (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const getCsrfCookie = (setCookie: string[] | undefined): string => {
    const entry = (setCookie ?? []).find((c) =>
      c.startsWith(`${CSRF_COOKIE}=`),
    );
    expect(entry).toBeDefined();
    return entry as string;
  };

  const getCsrfCookieValue = (setCookie: string[] | undefined): string => {
    const entry = getCsrfCookie(setCookie);
    return entry.split(';')[0].slice(`${CSRF_COOKIE}=`.length);
  };

  it('GET /v1/csrf/token returns a csrfToken body field and sets the CSRF cookie', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/csrf/token')
      .expect(200);

    expect(typeof res.body.csrfToken).toBe('string');
    expect(res.body.csrfToken.length).toBeGreaterThan(0);

    const cookie = getCsrfCookie(res.headers['set-cookie']);
    expect(cookie).toContain(`${CSRF_COOKIE}=`);
  });

  it('sets the CSRF cookie with the expected attributes', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/csrf/token')
      .expect(200);

    const cookie = getCsrfCookie(res.headers['set-cookie']);

    // The cookie must be readable by browser JavaScript (double-submit).
    expect(cookie).not.toMatch(/HttpOnly/i);
    expect(cookie).toContain('Path=/');
    expect(cookie).toMatch(/SameSite/i);
  });

  it('returns a body csrfToken that matches the CSRF cookie value', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/csrf/token')
      .expect(200);

    const cookieValue = getCsrfCookieValue(res.headers['set-cookie']);
    expect(res.body.csrfToken).toBe(cookieValue);
  });

  it('rejects a POST without a CSRF token with 403', async () => {
    await request(app.getHttpServer())
      .post('/v1/posts')
      .send({ title: 'Hello' })
      .expect(403);
  });

  it('accepts a POST with a valid CSRF token', async () => {
    const tokenRes = await request(app.getHttpServer())
      .get('/v1/csrf/token')
      .expect(200);

    const token = tokenRes.body.csrfToken;
    const cookie = getCsrfCookie(tokenRes.headers['set-cookie']);

    const res = await request(app.getHttpServer())
      .post('/v1/posts')
      .set('Cookie', cookie)
      .set(CSRF_HEADER, token)
      .send({ title: 'Hello' });

    expect(res.status).not.toBe(403);
  });

  it('rejects a POST with a mismatched cookie/header pair with 403', async () => {
    const tokenRes = await request(app.getHttpServer())
      .get('/v1/csrf/token')
      .expect(200);

    const cookie = getCsrfCookie(tokenRes.headers['set-cookie']);

    await request(app.getHttpServer())
      .post('/v1/posts')
      .set('Cookie', cookie)
      .set(CSRF_HEADER, 'deliberately-wrong-token')
      .send({ title: 'Hello' })
      .expect(403);
  });

  it('exempts /v1/webhook routes from CSRF protection', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/webhook/stripe')
      .send({ event: 'test' });

    expect(res.status).not.toBe(403);
  });

  it('bypasses CSRF for Bearer-authenticated requests', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/posts')
      .set('Authorization', 'Bearer test-token')
      .send({ title: 'Hello' });

    expect(res.status).not.toBe(403);
  });
});
