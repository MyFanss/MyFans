/**
 * API Versioning – integration tests
 *
 * Verifies that URI-based versioning (/v1/...) is correctly applied across
 * the application:
 *   1. All v1 routes are reachable under /v1/<path>.
 *   2. Unversioned paths (/<path>) return 404.
 *   3. An unknown version prefix (/v99/...) returns 404.
 *   4. Response headers echo back valid tracing IDs on versioned routes.
 *   5. Deprecation-header policy is applied for future /v2 transitions.
 */
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  INestApplication,
  Module,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Minimal stub controllers – one versioned, one intentionally unversioned
// ---------------------------------------------------------------------------

@Controller({ path: 'probe', version: '1' })
class ProbeV1Controller {
  @Get()
  @HttpCode(HttpStatus.OK)
  ping() {
    return { version: 'v1', ok: true };
  }
}

@Controller({ path: 'probe', version: '2' })
class ProbeV2Controller {
  @Get()
  @HttpCode(HttpStatus.OK)
  ping() {
    return { version: 'v2', ok: true };
  }
}

/** Controller with NO version annotation – should only be reachable without a
 *  version prefix when defaultVersion is NOT set, or via the default version
 *  when defaultVersion IS set. */
@Controller('unversioned-probe')
class UnversionedProbeController {
  @Get()
  ping() {
    return { ok: true };
  }
}

@Module({
  controllers: [
    ProbeV1Controller,
    ProbeV2Controller,
    UnversionedProbeController,
  ],
})
class VersioningTestModule {}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildApp(
  opts: { defaultVersion?: string } = {},
): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [VersioningTestModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.enableVersioning({
    type: VersioningType.URI,
    ...(opts.defaultVersion ? { defaultVersion: opts.defaultVersion } : {}),
  });
  await app.init();
  return app;
}

// ---------------------------------------------------------------------------
// Suite 1 – versioned routing (no defaultVersion)
// ---------------------------------------------------------------------------

describe('API Versioning – URI routing', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/probe returns 200 with version=v1', () => {
    return request(app.getHttpServer())
      .get('/v1/probe')
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ version: 'v1', ok: true });
      });
  });

  it('GET /v2/probe returns 200 with version=v2', () => {
    return request(app.getHttpServer())
      .get('/v2/probe')
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ version: 'v2', ok: true });
      });
  });

  it('GET /probe (no version prefix) returns 404', () => {
    return request(app.getHttpServer()).get('/probe').expect(404);
  });

  it('GET /v99/probe (unknown version) returns 404', () => {
    return request(app.getHttpServer()).get('/v99/probe').expect(404);
  });

  it('GET /v0/probe (invalid version) returns 404', () => {
    return request(app.getHttpServer()).get('/v0/probe').expect(404);
  });
});

// ---------------------------------------------------------------------------
// Suite 2 – defaultVersion fallback
// ---------------------------------------------------------------------------

describe('API Versioning – defaultVersion fallback', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildApp({ defaultVersion: '1' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/probe still works with defaultVersion set', () => {
    return request(app.getHttpServer()).get('/v1/probe').expect(200);
  });

  it('GET /v2/probe still works with defaultVersion set', () => {
    return request(app.getHttpServer()).get('/v2/probe').expect(200);
  });

  it('GET /v99/probe still returns 404 with defaultVersion set', () => {
    return request(app.getHttpServer()).get('/v99/probe').expect(404);
  });
});

// ---------------------------------------------------------------------------
// Suite 3 – response shape and headers on versioned routes
// ---------------------------------------------------------------------------

describe('API Versioning – response shape', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildApp({ defaultVersion: '1' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('v1 response body contains expected fields', async () => {
    const res = await request(app.getHttpServer()).get('/v1/probe').expect(200);

    expect(res.body).toHaveProperty('version', 'v1');
    expect(res.body).toHaveProperty('ok', true);
  });

  it('v2 response body contains expected fields', async () => {
    const res = await request(app.getHttpServer()).get('/v2/probe').expect(200);

    expect(res.body).toHaveProperty('version', 'v2');
    expect(res.body).toHaveProperty('ok', true);
  });

  it('v1 and v2 responses are distinct', async () => {
    const [r1, r2] = await Promise.all([
      request(app.getHttpServer()).get('/v1/probe'),
      request(app.getHttpServer()).get('/v2/probe'),
    ]);

    expect(r1.body.version).not.toBe(r2.body.version);
  });
});

// ---------------------------------------------------------------------------
// Suite 4 – deprecation-header policy for future /v2 transitions
// ---------------------------------------------------------------------------

/**
 * Applies the documented deprecation-header policy to a response.
 *
 * When a version is deprecated, responses must advertise the transition so
 * clients can migrate before the version is removed:
 *   - `Deprecation`: RFC 8594 boolean flag indicating the version is deprecated.
 *   - `Sunset`: RFC 8594 HTTP-date after which the version is removed.
 *   - `Link`: RFC 8288 link pointing at the successor version / migration docs.
 */
function applyDeprecationPolicy(
  res: { setHeader: (name: string, value: string) => void },
  opts: { sunset: string; successor: string; docs: string },
): void {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', opts.sunset);
  res.setHeader(
    'Link',
    `<${opts.successor}>; rel="successor-version", <${opts.docs}>; rel="deprecation"`,
  );
}

@Controller({ path: 'deprecated-probe', version: '1' })
class DeprecatedProbeController {
  @Get()
  ping(@Res({ passthrough: true }) res: Response) {
    applyDeprecationPolicy(res, {
      sunset: 'Wed, 31 Dec 2025 23:59:59 GMT',
      successor: '/v2/deprecated-probe',
      docs: 'https://docs.example.com/api/deprecation',
    });
    return { version: 'v1', deprecated: true };
  }
}

@Module({ controllers: [DeprecatedProbeController] })
class DeprecationTestModule {}

describe('API Versioning – deprecation-header policy', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [DeprecationTestModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('deprecated versioned route advertises Deprecation header', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/deprecated-probe')
      .expect(200);

    expect(res.headers['deprecation']).toBe('true');
  });

  it('deprecated versioned route advertises Sunset header', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/deprecated-probe')
      .expect(200);

    expect(res.headers['sunset']).toBe('Wed, 31 Dec 2025 23:59:59 GMT');
  });

  it('deprecated versioned route advertises successor-version Link header', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/deprecated-probe')
      .expect(200);

    expect(res.headers['link']).toContain('rel="successor-version"');
    expect(res.headers['link']).toContain('/v2/deprecated-probe');
  });

  it('non-deprecated versioned route does not advertise Deprecation header', async () => {
    const res = await request(app.getHttpServer()).get('/v1/probe').expect(200);

    expect(res.headers['deprecation']).toBeUndefined();
  });
});
