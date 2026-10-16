import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Plans Module (e2e)', () => {
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

  const validPlan = () => ({
    plan_id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    creator: 'test_creator_123',
    asset: 'USDC',
    amount: '100.00',
    interval: 'monthly',
  });

  describe('POST /v1/plans (Create plan metadata)', () => {
    it('should return 201 when plan metadata is created with valid data', async () => {
      const payload = validPlan();

      const response = await request(app.getHttpServer())
        .post('/v1/plans')
        .send(payload)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.plan_id).toBe(payload.plan_id);
      expect(response.body.asset).toBe(payload.asset);
      expect(response.body.amount).toBe(payload.amount);
      expect(response.body.interval).toBe(payload.interval);
    });

    it('should return 409 when plan_id already exists', async () => {
      const payload = validPlan();

      await request(app.getHttpServer())
        .post('/v1/plans')
        .send(payload)
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/plans')
        .send(payload)
        .expect(409);
    });

    it('should return 400 for an invalid asset', async () => {
      const payload = { ...validPlan(), asset: 'NOT_A_REAL_ASSET' };

      await request(app.getHttpServer())
        .post('/v1/plans')
        .send(payload)
        .expect(400);
    });

    it('should return 400 for an invalid amount', async () => {
      const payload = { ...validPlan(), amount: '-1' };

      await request(app.getHttpServer())
        .post('/v1/plans')
        .send(payload)
        .expect(400);
    });

    it('should return 400 for an invalid interval', async () => {
      const payload = { ...validPlan(), interval: 'every_other_fortnight' };

      await request(app.getHttpServer())
        .post('/v1/plans')
        .send(payload)
        .expect(400);
    });

    it('should replay the cached response for a repeated POST with the same Idempotency-Key', async () => {
      const payload = validPlan();
      const idempotencyKey = `idem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const first = await request(app.getHttpServer())
        .post('/v1/plans')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload)
        .expect(201);

      const second = await request(app.getHttpServer())
        .post('/v1/plans')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload)
        .expect(201);

      expect(second.body).toEqual(first.body);

      // A second plan must not have been created for the same plan_id.
      await request(app.getHttpServer())
        .post('/v1/plans')
        .send({ ...payload, plan_id: `${payload.plan_id}_other` })
        .expect(201);
    });
  });

  describe('PATCH /v1/plans/:planId (Update plan metadata)', () => {
    it('should return 200 when the owner updates the plan', async () => {
      const payload = validPlan();

      await request(app.getHttpServer())
        .post('/v1/plans')
        .send(payload)
        .expect(201);

      const response = await request(app.getHttpServer())
        .patch(`/v1/plans/${payload.plan_id}`)
        .send({ amount: '250.00' })
        .expect(200);

      expect(response.body.amount).toBe('250.00');
    });

    it('should return 403 when a non-owner mutates the plan', async () => {
      const payload = validPlan();

      await request(app.getHttpServer())
        .post('/v1/plans')
        .send(payload)
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/v1/plans/${payload.plan_id}`)
        .set('X-Creator-Id', 'someone_else_456')
        .send({ amount: '250.00' })
        .expect(403);
    });

    it('should return 404 when updating an unknown plan_id', async () => {
      await request(app.getHttpServer())
        .patch('/v1/plans/does_not_exist_999')
        .send({ amount: '250.00' })
        .expect(404);
    });

    it('should return 400 for an invalid amount on update', async () => {
      const payload = validPlan();

      await request(app.getHttpServer())
        .post('/v1/plans')
        .send(payload)
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/v1/plans/${payload.plan_id}`)
        .send({ amount: '-5' })
        .expect(400);
    });
  });

  describe('DELETE /v1/plans/:planId (Delete plan metadata)', () => {
    it('should return 204 when the owner deletes the plan', async () => {
      const payload = validPlan();

      await request(app.getHttpServer())
        .post('/v1/plans')
        .send(payload)
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/plans/${payload.plan_id}`)
        .expect(204);
    });

    it('should return 403 when a non-owner deletes the plan', async () => {
      const payload = validPlan();

      await request(app.getHttpServer())
        .post('/v1/plans')
        .send(payload)
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/plans/${payload.plan_id}`)
        .set('X-Creator-Id', 'someone_else_456')
        .expect(403);
    });

    it('should return 404 when deleting an unknown plan_id', async () => {
      await request(app.getHttpServer())
        .delete('/v1/plans/does_not_exist_999')
        .expect(404);
    });
  });
});
