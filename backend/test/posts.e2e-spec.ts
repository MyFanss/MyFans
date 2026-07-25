import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Posts Module (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── GET /v1/posts (primary endpoint) ────────────────────────────────────────

  describe('GET /v1/posts', () => {
    it('returns 200 with paginated response shape', async () => {
      const res = await request(app.getHttpServer()).get('/v1/posts').expect(200);

      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('limit');
      expect(res.body).toHaveProperty('hasMore');
    });

    it('supports page and limit query params', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/posts')
        .query({ page: 1, limit: 5 })
        .expect(200);

      expect(res.body.limit).toBe(5);
    });

    it('returns 400 for limit exceeding 100', async () => {
      await request(app.getHttpServer())
        .get('/v1/posts')
        .query({ limit: 101 })
        .expect(400);
    });

    it('returns 400 for page less than 1', async () => {
      await request(app.getHttpServer())
        .get('/v1/posts')
        .query({ page: 0 })
        .expect(400);
    });

    it('returns empty data array when no posts exist', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/posts')
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ── POST /v1/posts ────────────────────────────────────────────────────────────

  describe('POST /v1/posts', () => {
    it('returns 400 for missing title', async () => {
      await request(app.getHttpServer())
        .post('/v1/posts')
        .send({ content: 'Some content' })
        .expect(400);
    });

    it('returns 400 for missing content', async () => {
      await request(app.getHttpServer())
        .post('/v1/posts')
        .send({ title: 'A title' })
        .expect(400);
    });

    it('returns 400 for empty title', async () => {
      await request(app.getHttpServer())
        .post('/v1/posts')
        .send({ title: '', content: 'Body' })
        .expect(400);
    });

    it('returns 400 for title exceeding 500 characters', async () => {
      await request(app.getHttpServer())
        .post('/v1/posts')
        .send({ title: 'a'.repeat(501), content: 'Body' })
        .expect(400);
    });

    it('returns 400 for non-boolean isPublished', async () => {
      await request(app.getHttpServer())
        .post('/v1/posts')
        .send({ title: 'T', content: 'C', isPublished: 'yes' })
        .expect(400);
    });
  });

  // ── GET /v1/posts/author/:authorId ────────────────────────────────────────────

  describe('GET /v1/posts/author/:authorId', () => {
    it('returns 200 with paginated response for any authorId', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/posts/author/nonexistent-author')
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('supports limit query param', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/posts/author/some-author')
        .query({ limit: 10 })
        .expect(200);

      expect(res.body.limit).toBe(10);
    });
  });
});
