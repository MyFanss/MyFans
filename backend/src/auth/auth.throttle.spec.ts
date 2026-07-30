import {
  INestApplication,
  Module,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { WalletAuthService } from './wallet-auth.service';

const VALID_ADDRESS = `G${'A'.repeat(55)}`;

// Minimal module used by integration tests; limit is set to 1 to trigger 429 on the 2nd request.
@Module({
  imports: [ThrottlerModule.forRoot([{ name: 'auth', ttl: 60_000, limit: 1 }])],
  controllers: [AuthController],
  providers: [
    Reflector,
    ThrottlerGuard,
    {
      provide: AuthService,
      useValue: {
        validateStellarAddress: jest.fn().mockReturnValue(true),
        createSession: jest
          .fn()
          .mockResolvedValue({ userId: VALID_ADDRESS, token: 'tok' }),
      },
    },
    {
      provide: WalletAuthService,
      useValue: {
        createChallenge: jest
          .fn()
          .mockResolvedValue({ nonce: 'nonce-1', expiresAt: new Date(Date.now() + 300_000) }),
        verifyAndIssueToken: jest
          .fn()
          .mockResolvedValue({ access_token: 'jwt', token_type: 'Bearer' }),
      },
    },
  ],
})
class AuthThrottleTestModule {}

describe('AuthController – rate limiting', () => {
  describe('guard and throttle metadata', () => {
    it('controller has ThrottlerGuard applied at class level', () => {
      const guards = Reflect.getMetadata('__guards__', AuthController);
      expect(guards).toBeDefined();
      expect(guards).toContain(ThrottlerGuard);
    });

    it.each(['login', 'register', 'requestChallenge', 'verifyChallenge'])(
      '%s has @Throttle({ auth }) with limit 5 and ttl 60000',
      (method) => {
        const proto = AuthController.prototype;
        const limit = Reflect.getMetadata('THROTTLER:LIMITauth', proto[method]);
        const ttl = Reflect.getMetadata('THROTTLER:TTLauth', proto[method]);
        expect(limit).toBe(5);
        expect(ttl).toBe(60_000);
      },
    );
  });

  // Each endpoint gets its own fresh app so throttle counters don't bleed across tests.
  // The @Throttle({ auth: { limit: 5 } }) decorator takes precedence over the module
  // default, so 5 requests are allowed and the 6th is rejected with 429.
  describe('HTTP integration (limit: 5 per window per @Throttle)', () => {
    async function buildApp(): Promise<INestApplication> {
      const module: TestingModule = await Test.createTestingModule({
        imports: [AuthThrottleTestModule],
      }).compile();
      const app = module.createNestApplication();
      app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
      await app.init();
      return app;
    }

    describe('POST /v1/auth/login', () => {
      let app: INestApplication;
      beforeAll(async () => { app = await buildApp(); });
      afterAll(() => app.close());

      it('allows 5 requests within the limit', async () => {
        for (let i = 0; i < 5; i++) {
          await request(app.getHttpServer())
            .post('/v1/auth/login')
            .send({ address: VALID_ADDRESS })
            .expect(201);
        }
      });

      it('returns 429 when the limit is exceeded', async () => {
        const res = await request(app.getHttpServer())
          .post('/v1/auth/login')
          .send({ address: VALID_ADDRESS })
          .expect(429);

        expect(res.body.statusCode).toBe(429);
        expect(res.body.message).toMatch(/too many requests/i);
      });
    });

    describe('POST /v1/auth/register', () => {
      let app: INestApplication;
      beforeAll(async () => { app = await buildApp(); });
      afterAll(() => app.close());

      it('allows 5 requests within the limit', async () => {
        for (let i = 0; i < 5; i++) {
          await request(app.getHttpServer())
            .post('/v1/auth/register')
            .send({ address: VALID_ADDRESS })
            .expect(201);
        }
      });

      it('returns 429 when the limit is exceeded', async () => {
        const res = await request(app.getHttpServer())
          .post('/v1/auth/register')
          .send({ address: VALID_ADDRESS })
          .expect(429);

        expect(res.body.statusCode).toBe(429);
        expect(res.body.message).toMatch(/too many requests/i);
      });
    });

    describe('POST /v1/auth/challenge', () => {
      let app: INestApplication;
      beforeAll(async () => { app = await buildApp(); });
      afterAll(() => app.close());

      it('allows 5 requests within the limit', async () => {
        for (let i = 0; i < 5; i++) {
          await request(app.getHttpServer())
            .post('/v1/auth/challenge')
            .send({ address: VALID_ADDRESS })
            .expect(200);
        }
      });

      it('returns 429 when the limit is exceeded', async () => {
        const res = await request(app.getHttpServer())
          .post('/v1/auth/challenge')
          .send({ address: VALID_ADDRESS })
          .expect(429);

        expect(res.body.statusCode).toBe(429);
        expect(res.body.message).toMatch(/too many requests/i);
      });
    });

    describe('POST /v1/auth/challenge/verify', () => {
      let app: INestApplication;
      beforeAll(async () => { app = await buildApp(); });
      afterAll(() => app.close());

      const verifyBody = { address: VALID_ADDRESS, nonce: 'nonce-1', signature: 'deadbeef' };

      it('allows 5 requests within the limit', async () => {
        for (let i = 0; i < 5; i++) {
          await request(app.getHttpServer())
            .post('/v1/auth/challenge/verify')
            .send(verifyBody)
            .expect(200);
        }
      });

      it('returns 429 when the limit is exceeded', async () => {
        const res = await request(app.getHttpServer())
          .post('/v1/auth/challenge/verify')
          .send(verifyBody)
          .expect(429);

        expect(res.body.statusCode).toBe(429);
        expect(res.body.message).toMatch(/too many requests/i);
      });
    });
  });
});
