import {
  INestApplication,
  Module,
  ValidationPipe,
  VersioningType,
  Controller,
  Post,
  Param,
  Body,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { SocialLinksModule } from '../src/social-links/social-links.module';
import {
  SocialLinksService,
  MAX_SOCIAL_LINKS_PER_USER,
} from '../src/social-links/social-links.service';

type ValidationErrorResponse = {
  message: string | string[];
};

type SocialLinksListResponse = {
  data: Array<{
    id: string;
    websiteUrl: string | null;
    twitterHandle: string | null;
    instagramHandle: string | null;
    otherLink: string | null;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
};

@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 10 }]),
    SocialLinksModule,
  ],
})
class SocialLinksE2ETestModule {}

describe('Social links primary endpoint (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SocialLinksE2ETestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /v1/social-links accepts a valid social-links payload', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/social-links')
      .send({
        websiteUrl: 'https://twitter.com/johndoe',
        twitterHandle: '@JohnDoe',
        instagramHandle: '@PhotoFan',
        otherLink: 'https://linkedin.com/in/johndoe',
      })
      .expect(201);

    expect(res.body).toEqual({
      websiteUrl: 'https://twitter.com/johndoe',
      twitterHandle: 'johndoe',
      instagramHandle: 'photofan',
      otherLink: 'https://linkedin.com/in/johndoe',
    });
  });

  it('POST /v1/social-links rejects invalid input with a 400 response', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/social-links')
      .send({
        websiteUrl: 'javascript:alert(1)',
        twitterHandle: 'bad handle',
      })
      .expect(400);

    const body = res.body as ValidationErrorResponse;
    expect(JSON.stringify(body.message)).toMatch(/website_url|twitter_handle/i);
  });

  it('GET /v1/social-links returns a paginated list with limit support', async () => {
    await request(app.getHttpServer())
      .post('/v1/social-links')
      .send({ twitterHandle: 'first' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/v1/social-links')
      .send({ twitterHandle: 'second' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/v1/social-links?page=1&limit=1')
      .expect(200);

    const body = res.body as SocialLinksListResponse;
    expect(body).toMatchObject({
      total: 2,
      page: 1,
      limit: 1,
      totalPages: 2,
      hasMore: true,
    });
    expect(body.data).toEqual([
      {
        id: '1',
        websiteUrl: null,
        twitterHandle: 'first',
        instagramHandle: null,
        otherLink: null,
      },
    ]);
  });

  it('GET /v1/social-links validates pagination query params', async () => {
    await request(app.getHttpServer())
      .get('/v1/social-links?limit=101')
      .expect(400);
  });
});

/**
 * Per-user cap integration test.
 *
 * Uses a dedicated test module with a stub controller wired to the real
 * SocialLinksService so we can verify the cap is enforced over HTTP.
 */
@Controller({ path: 'social-links', version: '1' })
class SocialLinksTestController {
  constructor(private readonly service: SocialLinksService) {}

  @Post(':userId')
  create(
    @Param('userId') userId: string,
    @Body() input: { platform: string; url: string },
  ) {
    return this.service.create(userId, input);
  }
}

@Module({
  controllers: [SocialLinksTestController],
  providers: [SocialLinksService],
})
class SocialLinksCapTestModule {}

describe('Social links per-user cap (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SocialLinksCapTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it(`POST returns 201 for the ${MAX_SOCIAL_LINKS_PER_USER}th link`, async () => {
    for (let i = 0; i < MAX_SOCIAL_LINKS_PER_USER; i++) {
      await request(app.getHttpServer())
        .post(`/v1/social-links/cap-user`)
        .send({ platform: `platform-${i}`, url: `https://example.com/${i}` })
        .expect(201);
    }
  });

  it('POST returns 400 when the cap is exceeded', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/social-links/cap-user')
      .send({ platform: 'extra', url: 'https://example.com/extra' })
      .expect(400);

    expect(res.body).toMatchObject({
      statusCode: 400,
      message: 'too many social links',
    });
  });

  it('allows a different user to create links after the first user hit the cap', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/social-links/other-user')
      .send({ platform: 'github', url: 'https://github.com/example' })
      .expect(201);

    expect(res.body).toMatchObject({
      userId: 'other-user',
      platform: 'github',
      url: 'https://github.com/example',
    });
  });
});