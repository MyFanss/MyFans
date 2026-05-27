import {
  Controller,
  Get,
  INestApplication,
  Module,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { SocialLinksModule } from './social-links.module';

@Controller({ path: 'status', version: '1' })
class StubReadController {
  @Get()
  read() {
    return { ok: true };
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 2 }]),
    SocialLinksModule,
  ],
  controllers: [StubReadController],
})
class SocialLinksThrottleTestModule {}

describe('SocialLinkController rate limiting', () => {
  let app: INestApplication;
  const validPayload = { websiteUrl: 'https://twitter.com/johndoe' };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SocialLinksThrottleTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/social-links', () => {
    it('allows requests within the limit (5 per minute)', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/v1/social-links')
          .send(validPayload)
          .expect(201);
      }
    });

    it('returns 429 with a clear message when the limit is exceeded', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/social-links')
        .send(validPayload)
        .expect(429);

      expect(res.body).toMatchObject({
        statusCode: 429,
        message: expect.stringMatching(/too many requests/i),
      });
    });
  });

  describe('PATCH /v1/social-links/:id', () => {
    let patchApp: INestApplication;

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [SocialLinksThrottleTestModule],
      }).compile();

      patchApp = moduleFixture.createNestApplication();
      patchApp.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
      patchApp.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      await patchApp.init();
    });

    afterAll(async () => {
      await patchApp.close();
    });

    it('returns 429 when update limit is exceeded', async () => {
      for (let i = 0; i < 5; i++) {
        await request(patchApp.getHttpServer())
          .patch('/v1/social-links/user-1')
          .send(validPayload)
          .expect(200);
      }

      const res = await request(patchApp.getHttpServer())
        .patch('/v1/social-links/user-1')
        .send(validPayload)
        .expect(429);

      expect(res.body.statusCode).toBe(429);
      expect(res.body.message).toMatch(/too many requests/i);
    });
  });

  describe('unrelated read endpoint', () => {
    it('is not throttled by social-links write limits', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).get('/v1/status').expect(200);
      }
    });
  });
});
