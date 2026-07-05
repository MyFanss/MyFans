import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import request, { type Response } from 'supertest';
import { App } from 'supertest/types';
import { FeatureFlagsModule } from '../src/feature-flags/feature-flags.module';
import { FeatureFlagGuard } from '../src/feature-flags/feature-flag.guard';
import {
  FeatureFlagsService,
  type FeatureFlagsSnapshot,
} from '../src/feature-flags/feature-flags.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Boot a minimal NestJS app that only loads FeatureFlagsModule. */
async function buildApp(): Promise<INestApplication<App>> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [FeatureFlagsModule],
  }).compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

function featureFlagsBody(res: Response): FeatureFlagsSnapshot {
  const body = res.body as unknown;
  return body as FeatureFlagsSnapshot;
}

// ---------------------------------------------------------------------------
// GET /v1/feature-flags
// ---------------------------------------------------------------------------

describe('FeatureFlagsController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    // Clean up env overrides so tests are isolated
    delete process.env.FEATURE_FLAG_BOOKMARKS;
    delete process.env.NEXT_PUBLIC_FLAG_BOOKMARKS;
    delete process.env.FEATURE_FLAG_EARNINGS_WITHDRAWALS;
    delete process.env.NEXT_PUBLIC_FLAG_EARNINGS_WITHDRAWALS;
    delete process.env.FEATURE_FLAG_EARNINGS_FEE_TRANSPARENCY;
    delete process.env.NEXT_PUBLIC_FLAG_EARNINGS_FEE_TRANSPARENCY;
    delete process.env.FEATURE_NEW_SUBSCRIPTION_FLOW;
    delete process.env.FEATURE_FLAG_NEW_SUBSCRIPTION_FLOW;
    delete process.env.FEATURE_CRYPTO_PAYMENTS;
    delete process.env.FEATURE_FLAG_CRYPTO_PAYMENTS;
    delete process.env.FEATURE_REFERRAL_CODES;
    delete process.env.FEATURE_SOROBAN_POLLER;
  });

  it('GET /v1/feature-flags returns the complete primary endpoint snapshot', () => {
    process.env.FEATURE_FLAG_BOOKMARKS = 'true';
    process.env.FEATURE_FLAG_EARNINGS_WITHDRAWALS = 'false';
    process.env.FEATURE_FLAG_EARNINGS_FEE_TRANSPARENCY = '1';
    process.env.FEATURE_NEW_SUBSCRIPTION_FLOW = 'true';
    process.env.FEATURE_CRYPTO_PAYMENTS = 'off';
    process.env.FEATURE_REFERRAL_CODES = 'yes';
    process.env.FEATURE_SOROBAN_POLLER = 'false';

    return request(app.getHttpServer())
      .get('/v1/feature-flags')
      .expect(200)
      .expect((res) => {
        expect(featureFlagsBody(res)).toEqual({
          bookmarks: true,
          earnings_withdrawals: false,
          earnings_fee_transparency: true,
          newSubscriptionFlow: true,
          cryptoPayments: false,
          referralCodes: true,
          sorobanPoller: false,
        });
      });
  });

  it('returns false for all flags when env vars are absent', () => {
    delete process.env.FEATURE_NEW_SUBSCRIPTION_FLOW;
    delete process.env.FEATURE_CRYPTO_PAYMENTS;

    return request(app.getHttpServer())
      .get('/v1/feature-flags')
      .expect(200)
      .expect((res) => {
        const body = featureFlagsBody(res);
        expect(body.newSubscriptionFlow).toBe(false);
        expect(body.cryptoPayments).toBe(false);
      });
  });

  it('reflects FEATURE_NEW_SUBSCRIPTION_FLOW=true', () => {
    process.env.FEATURE_NEW_SUBSCRIPTION_FLOW = 'true';

    return request(app.getHttpServer())
      .get('/v1/feature-flags')
      .expect(200)
      .expect((res) => {
        const body = featureFlagsBody(res);
        expect(body.newSubscriptionFlow).toBe(true);
        expect(body.cryptoPayments).toBe(false);
      });
  });

  it('reflects FEATURE_CRYPTO_PAYMENTS=true', () => {
    process.env.FEATURE_CRYPTO_PAYMENTS = 'true';

    return request(app.getHttpServer())
      .get('/v1/feature-flags')
      .expect(200)
      .expect((res) => {
        const body = featureFlagsBody(res);
        expect(body.newSubscriptionFlow).toBe(false);
        expect(body.cryptoPayments).toBe(true);
      });
  });

  it('reflects both flags enabled simultaneously', () => {
    process.env.FEATURE_NEW_SUBSCRIPTION_FLOW = 'true';
    process.env.FEATURE_CRYPTO_PAYMENTS = 'true';

    return request(app.getHttpServer())
      .get('/v1/feature-flags')
      .expect(200)
      .expect((res) => {
        const body = featureFlagsBody(res);
        expect(body.newSubscriptionFlow).toBe(true);
        expect(body.cryptoPayments).toBe(true);
      });
  });

  it('treats an invalid env value as false (fail-closed)', () => {
    process.env.FEATURE_NEW_SUBSCRIPTION_FLOW = 'definitely';

    return request(app.getHttpServer())
      .get('/v1/feature-flags')
      .expect(200)
      .expect((res) => {
        expect(featureFlagsBody(res).newSubscriptionFlow).toBe(false);
      });
  });
});

// ---------------------------------------------------------------------------
// FeatureFlagGuard — unit-level guard tests
// ---------------------------------------------------------------------------

describe('FeatureFlagGuard', () => {
  let guard: FeatureFlagGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeatureFlagGuard, FeatureFlagsService, Reflector],
    }).compile();

    guard = module.get(FeatureFlagGuard);
    reflector = module.get(Reflector);
  });

  afterEach(() => {
    delete process.env.FEATURE_NEW_SUBSCRIPTION_FLOW;
    delete process.env.FEATURE_CRYPTO_PAYMENTS;
  });

  const makeContext = (flag: string | undefined): ExecutionContext => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(flag);

    return {
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  it('allows access when no flag is required', () => {
    const ctx = makeContext(undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows access when the required flag is enabled', () => {
    process.env.FEATURE_NEW_SUBSCRIPTION_FLOW = 'true';
    const ctx = makeContext('newSubscriptionFlow');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when the required flag is disabled', () => {
    delete process.env.FEATURE_NEW_SUBSCRIPTION_FLOW;
    const ctx = makeContext('newSubscriptionFlow');
    expect(() => guard.canActivate(ctx)).toThrow();
  });

  it('throws ForbiddenException for an unknown flag (fail-closed)', () => {
    const ctx = makeContext('nonExistentFlag');
    expect(() => guard.canActivate(ctx)).toThrow();
  });

  it('throws ForbiddenException when flag env var is set to an invalid value', () => {
    process.env.FEATURE_CRYPTO_PAYMENTS = 'enabled'; // not "true"
    const ctx = makeContext('cryptoPayments');
    expect(() => guard.canActivate(ctx)).toThrow();
  });

  it('allows access for cryptoPayments when enabled', () => {
    process.env.FEATURE_CRYPTO_PAYMENTS = 'true';
    const ctx = makeContext('cryptoPayments');
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
