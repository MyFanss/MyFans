import {
  INestApplication,
  Module,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { SocialLinksModule } from '../src/social-link/social-links.module';

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
