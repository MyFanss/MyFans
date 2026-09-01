import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { SocialLinkController } from './social-links.controller';
import { SocialLinksService } from './social-links.service';

describe('SocialLinkController rate limiting', () => {
  let app: INestApplication | undefined;
  const validPayload = { websiteUrl: 'https://twitter.com/johndoe' };

  const mockService = {
    createSocialLinks: jest
      .fn()
      .mockResolvedValue({ id: '1', ...validPayload }),
    updateSocialLinks: jest
      .fn()
      .mockResolvedValue({ id: '1', ...validPayload }),
    listSocialLinks: jest.fn().mockResolvedValue({ data: [], meta: {} }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 2 }]),
      ],
      controllers: [SocialLinkController],
      providers: [{ provide: SocialLinksService, useValue: mockService }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('POST /v1/social-links', () => {
    it('allows requests within the limit (5 per minute)', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app!.getHttpServer())
          .post('/v1/social-links')
          .send(validPayload)
          .expect(201);
      }
    });

    it('returns 429 with a clear message when the limit is exceeded', async () => {
      const res = await request(app!.getHttpServer())
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
    let patchApp: INestApplication | undefined;

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 2 }]),
        ],
        controllers: [SocialLinkController],
        providers: [{ provide: SocialLinksService, useValue: mockService }],
      }).compile();

      patchApp = moduleFixture.createNestApplication();
      patchApp.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
      });
      patchApp.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      await patchApp.init();
    });

    afterAll(async () => {
      if (patchApp) await patchApp.close();
    });

    it('returns 429 when update limit is exceeded', async () => {
      for (let i = 0; i < 5; i++) {
        await request(patchApp!.getHttpServer())
          .patch('/v1/social-links/user-1')
          .send(validPayload)
          .expect(200);
      }

      await request(patchApp!.getHttpServer())
        .patch('/v1/social-links/user-1')
        .send(validPayload)
        .expect(429);
    });
  });
});
