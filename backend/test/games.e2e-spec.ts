import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Games Module (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/games/:id/join (primary endpoint)', () => {
    it('should return 401 when no JWT is supplied', async () => {
      await request(app.getHttpServer())
        .post('/v1/games/550e8400-e29b-41d4-a716-446655440000/join')
        .send({})
        .expect(401);
    });

    it('should return 401 for a malformed bearer token', async () => {
      await request(app.getHttpServer())
        .post('/v1/games/550e8400-e29b-41d4-a716-446655440000/join')
        .set('Authorization', 'Bearer not-a-real-token')
        .send({})
        .expect(401);
    });

    it('should ignore a spoofed userId in the body and still require auth', async () => {
      // Even with a body claiming another identity, an unauthenticated
      // caller is rejected before that body is ever consulted.
      await request(app.getHttpServer())
        .post('/v1/games/550e8400-e29b-41d4-a716-446655440000/join')
        .send({ userId: '660e8400-e29b-41d4-a716-446655440001' })
        .expect(401);
    });
  });

  describe('GET /v1/games (list games with pagination)', () => {
    it('should return 200 with paginated games list', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/games')
        .expect(200);

      const body = response.body as { data: unknown[] };
      expect(response.body).toBeDefined();
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('hasMore');
    });

    it('should support limit query parameter', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/games')
        .query({ limit: 5 })
        .expect(200);

      expect((response.body as { limit: number }).limit).toBe(5);
    });

    it('should support page query parameter', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/games')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect((response.body as { page: number }).page).toBe(1);
    });

    it('should reject limit greater than 100', async () => {
      await request(app.getHttpServer())
        .get('/v1/games')
        .query({ limit: 101 })
        .expect(400);
    });

    it('should reject limit less than 1', async () => {
      await request(app.getHttpServer())
        .get('/v1/games')
        .query({ limit: 0 })
        .expect(400);
    });

    it('should reject invalid page parameter', async () => {
      await request(app.getHttpServer())
        .get('/v1/games')
        .query({ page: 0 })
        .expect(400);
    });

    it('should use default pagination when no params provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/games')
        .expect(200);

      expect((response.body as { limit: number }).limit).toBe(20);
    });

    it('should support status filter', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/games')
        .query({ status: 'PENDING' })
        .expect(200);

      const body = response.body as { data: unknown[] };
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
    });
  });
});
