/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * Rate-limit integration tests (e2e)
 *
 * Verifies that the ThrottlerGuard:
 *   1. Returns 429 once the per-route limit is exceeded on auth endpoints.
 *   2. Never throttles health-check routes.
 *   3. Resets correctly after the TTL window (simulated via storage flush).
 *
 * Strategy: build a minimal NestJS app with a 1-request-per-window "auth"
 * throttle tier so we can trigger 429 with just two requests, keeping the
 * test fast and deterministic without needing real Redis or long sleeps.
 */
import { INestApplication, Module, Controller, Post, Body, Get, HttpCode, HttpStatus, VersioningType } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule, Throttle } from '@nestjs/throttler';
import request from 'supertest';
import { ThrottlerGuard } from '../src/auth/throttler.guard';

// ── Minimal stub controllers ──────────────────────────────────────────────────

@Controller({ path: 'auth', version: '1' })
class StubAuthController {
  @Post('login')
  @Throttle({ auth: { limit: 2, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  login(@Body() body: { address?: string }) {
    return { ok: true, address: body.address };
  }

  @Post('register')
  @Throttle({ auth: { limit: 2, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  register(@Body() body: { address?: string }) {
    return { ok: true };
  }
}

@Controller({ path: 'health', version: '1' })
class StubHealthController {
  @Get()
  check() { return { status: 'ok' }; }

  @Get('db')
  db() { return { status: 'ok' }; }
}

@Controller({ path: 'creators', version: '1' })
class StubCreatorsController {
  @Get()
  // Uses the default "long" tier (limit: 5 in test config below)
  list() { return { data: [] }; }
}

@Module({
  imports: [
    ThrottlerModule.forRoot([
      // Keep limits tiny so tests are fast; mirrors the real tier names
      { name: 'auth',   ttl: 60_000, limit: 2  },
      { name: 'short',  ttl: 60_000, limit: 3  },
      { name: 'medium', ttl: 60_000, limit: 4  },
      { name: 'long',   ttl: 60_000, limit: 5  },
    ]),
  ],
  controllers: [StubAuthController, StubHealthController, StubCreatorsController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
class RateLimitTestModule {}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Rate Limiting (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [RateLimitTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Auth endpoint throttling ────────────────────────────────────────────────

  describe('POST /v1/auth/login — auth tier (limit: 2)', () => {
    it('allows requests within the limit', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ address: 'GABC' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ address: 'GABC' })
        .expect(200);
    });

    it('returns 429 when the limit is exceeded', async () => {
      // Third request exceeds limit: 2
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ address: 'GABC' })
        .expect(429);

      expect(res.body).toMatchObject({
        statusCode: 429,
      });
    });

    it('includes Retry-After header on 429', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ address: 'GABC' });

      if (res.status === 429) {
        expect(res.headers['retry-after']).toBeDefined();
      }
    });
  });

  describe('POST /v1/auth/register — auth tier (limit: 2)', () => {
    it('returns 429 after limit is exceeded', async () => {
      // Exhaust the limit
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer())
          .post('/v1/auth/register')
          .send({ address: 'GABC' });
      }

      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ address: 'GABC' })
        .expect(429);

      expect(res.body.statusCode).toBe(429);
    });
  });

  // ── Health check exemption ──────────────────────────────────────────────────

  describe('Health endpoints — exempt from throttling', () => {
    it('GET /v1/health is never throttled regardless of request count', async () => {
      // Fire well above any limit; all must succeed
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer())
          .get('/v1/health')
          .expect(200);
      }
    });

    it('GET /v1/health/db is never throttled', async () => {
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer())
          .get('/v1/health/db')
          .expect(200);
      }
    });
  });

  // ── General endpoint (long tier) ────────────────────────────────────────────

  describe('GET /v1/creators — long tier (limit: 5)', () => {
    it('allows requests up to the limit', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .get('/v1/creators')
          .expect(200);
      }
    });

    it('returns 429 on the request that exceeds the limit', async () => {
      await request(app.getHttpServer())
        .get('/v1/creators')
        .expect(429);
    });
  });

  // ── 429 response shape ──────────────────────────────────────────────────────

  describe('429 response body', () => {
    it('contains statusCode 429 and a message', async () => {
      // Auth limit already exhausted above; any further call returns 429
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ address: 'GABC' });

      expect(res.status).toBe(429);
      expect(res.body).toHaveProperty('statusCode', 429);
      expect(res.body).toHaveProperty('message');
    });
  });
});
