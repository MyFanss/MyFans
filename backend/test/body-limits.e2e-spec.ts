/**
 * Request body-size limit tests (e2e) — issue #1594.
 *
 * `main.ts` creates the app with `bodyParser: false` and installs
 * size-capped parsers via `configureBodyLimits()`. e2e specs build the app
 * from a module (not `main.ts`), so we apply the same helper here and
 * assert the 256 KB JSON cap is enforced with a clean 413 + correlation id.
 */
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  INestApplication,
  Module,
  Post,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { configureBodyLimits } from '../src/common/app-setup';
import { MAX_JSON_BODY_BYTES } from '../src/common/constants/body-upload-quotas';

@Controller({ path: 'echo', version: '1' })
class EchoController {
  @Post()
  @HttpCode(HttpStatus.OK)
  echo(@Body() body: { blob?: string }) {
    return { length: body?.blob?.length ?? 0 };
  }
}

@Module({ controllers: [EchoController] })
class BodyLimitsTestModule {}

describe('Request body limits (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [BodyLimitsTestModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureBodyLimits(app);
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a small JSON body', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/echo')
      .send({ blob: 'x'.repeat(1000) })
      .expect(200);
    expect(res.body).toEqual({ length: 1000 });
  });

  it('rejects a JSON body over the 256 KB limit with 413', async () => {
    const oversized = 'x'.repeat(MAX_JSON_BODY_BYTES + 1024);
    const res = await request(app.getHttpServer())
      .post('/v1/echo')
      .set('x-correlation-id', 'test-correlation-id')
      .send({ blob: oversized });

    expect(res.status).toBe(413);
    expect(res.body).toHaveProperty('statusCode', 413);
    expect(res.headers['x-correlation-id']).toBe('test-correlation-id');
    expect(res.body).toHaveProperty('correlationId', 'test-correlation-id');
  });
});
