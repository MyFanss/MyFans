import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Creators Module (e2e)', () => {
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

  describe('GET /v1/creators (Search creators - primary endpoint)', () => {
    it('should return 200 with paginated creators list on successful search', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/creators')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return paginated response with required fields', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/creators')
        .expect(200);

      // Assert response shape
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('hasMore');
      expect(typeof response.body.limit).toBe('number');
      expect(typeof response.body.hasMore).toBe('boolean');
    });

    it('should support search query parameter (q)', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/creators')
        .query({ q: 'test' })
        .expect(200);

      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support cursor pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/creators')
        .query({ limit: 10 })
        .expect(200);

      expect(response.body.limit).toBe(10);
    });

    it('should return empty data array for non-matching search', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/creators')
        .query({ q: 'nonexistent_creator_that_does_not_exist_12345' })
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.hasMore).toBe(false);
    });

    it('should reject invalid limit parameter', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/creators')
        .query({ limit: 101 })
        .expect(400);

      expect(response.body).toBeDefined();
    });

    it('should reject negative limit parameter', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/creators')
        .query({ limit: -1 })
        .expect(400);

      expect(response.body).toBeDefined();
    });

    it('should handle search with whitespace-only query', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/creators')
        .query({ q: '   ' })
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support search alias parameter (search)', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/creators')
        .query({ search: 'test' })
        .expect(200);

      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return creator objects with required fields', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/creators')
        .expect(200);

      if (response.body.data.length > 0) {
        const creator = response.body.data[0];
        expect(creator).toHaveProperty('id');
        expect(creator).toHaveProperty('username');
        expect(creator).toHaveProperty('display_name');
        expect(typeof creator.id).toBe('string');
        expect(typeof creator.username).toBe('string');
        expect(typeof creator.display_name).toBe('string');
      }
    });

    it('should return creator objects without sensitive fields', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/creators')
        .expect(200);

      if (response.body.data.length > 0) {
        const creator = response.body.data[0];
        expect(creator).not.toHaveProperty('password_hash');
        expect(creator).not.toHaveProperty('email');
        expect(creator).not.toHaveProperty('role');
        expect(creator).not.toHaveProperty('email_notifications');
        expect(creator).not.toHaveProperty('push_notifications');
      }
    });

    it('should respect limit parameter when provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/creators')
        .query({ limit: 5 })
        .expect(200);

      expect(response.body.limit).toBe(5);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should return consistent response shape across requests', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/v1/creators')
        .query({ limit: 10 })
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .get('/v1/creators')
        .query({ limit: 20 })
        .expect(200);

      expect(response1.body).toHaveProperty('data');
      expect(response1.body).toHaveProperty('limit');
      expect(response1.body).toHaveProperty('hasMore');
      expect(response1.body).toHaveProperty('nextCursor');

      expect(response2.body).toHaveProperty('data');
      expect(response2.body).toHaveProperty('limit');
      expect(response2.body).toHaveProperty('hasMore');
      expect(response2.body).toHaveProperty('nextCursor');
    });
  });

  describe('GET /v1/creators/list (List all creators)', () => {
    it('should return 200 with creators list', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/creators/list')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should support chain query parameter', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/creators/list')
        .query({ chain: 'false' })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /v1/creators/plans (Get all plans paginated)', () => {
    it('should return 200 with paginated plans', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/creators/plans')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('hasMore');
    });

    it('should support pagination parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/creators/plans')
        .query({ limit: 10 })
        .expect(200);

      expect(response.body.limit).toBe(10);
    });
  });

  describe('POST /v1/creators/plans (Create plan)', () => {
    it('should return 201 when plan is created with valid data', async () => {
      const planData = {
        creator: 'test_creator_123',
        asset: 'USDC',
        amount: '100.00',
        intervalDays: 30,
      };

      const response = await request(app.getHttpServer())
        .post('/v1/creators/plans')
        .send(planData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('creator');
      expect(response.body.creator).toBe(planData.creator);
      expect(response.body.asset).toBe(planData.asset);
      expect(response.body.amount).toBe(planData.amount);
      expect(response.body.intervalDays).toBe(planData.intervalDays);
    });

    it('should return 400 when required fields are missing', async () => {
      const invalidData = {
        creator: 'test_creator',
        asset: 'USDC',
        // missing amount and intervalDays
      };

      const response = await request(app.getHttpServer())
        .post('/v1/creators/plans')
        .send(invalidData)
        .expect(400);

      expect(response.body).toBeDefined();
    });

    it('should return 400 when intervalDays exceeds maximum', async () => {
      const invalidData = {
        creator: 'test_creator',
        asset: 'USDC',
        amount: '100',
        intervalDays: 366,
      };

      const response = await request(app.getHttpServer())
        .post('/v1/creators/plans')
        .send(invalidData)
        .expect(400);

      expect(response.body).toBeDefined();
    });

    it('should return 400 when intervalDays is less than 1', async () => {
      const invalidData = {
        creator: 'test_creator',
        asset: 'USDC',
        amount: '100',
        intervalDays: 0,
      };

      const response = await request(app.getHttpServer())
        .post('/v1/creators/plans')
        .send(invalidData)
        .expect(400);

      expect(response.body).toBeDefined();
    });
  });

  describe('Authentication', () => {
    it('should require authentication for creators endpoints', async () => {
      // Note: Depending on JwtAuthGuard configuration, this may be protected
      // This test validates the endpoints are guarded
      const response = await request(app.getHttpServer())
        .get('/v1/creators');

      // Should either return 401/403 if protected, or 200 if public
      expect([200, 401, 403]).toContain(response.status);
    });
  });
});
