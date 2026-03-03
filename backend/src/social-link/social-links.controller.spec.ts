import { Test, TestingModule } from '@nestjs/testing';
import { SocialLinkController } from './social-links.controller';
import { SocialLinksService } from './social-links.service';
import { ThrottlerModule } from '@nestjs/throttler';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';


describe('SocialLinkController', () => {
  let app: INestApplication;

  const mockSocialLinksService = {
    extractUpdatePayload: jest.fn().mockImplementation(dto => dto),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ ttl: 60, limit: 5 }]),
      ],
      controllers: [SocialLinkController],
      providers: [
        {
          provide: SocialLinksService,
          useValue: mockSocialLinksService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should be defined', () => {
    const controller = app.get<SocialLinkController>(SocialLinkController);
    expect(controller).toBeDefined();
  });

  describe('POST /social-links', () => {
    it('should return 429 when rate limit is exceeded', async () => {
      const socialLinksDto = {
        websiteUrl: 'https://example.com',
        twitterHandle: 'test',
        instagramHandle: 'test',
        otherLink: 'https://test.com',
      };

      // First 5 should succeed
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/social-links')
          .send(socialLinksDto)
          .expect(201);
      }

      // 6th should be rejected
      await request(app.getHttpServer())
        .post('/social-links')
        .send(socialLinksDto)
        .expect(429);
    });
  });
});