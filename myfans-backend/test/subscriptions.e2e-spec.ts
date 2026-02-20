import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from './../src/app.module';
import { applyAppConfig } from './../src/app.config';
import { Creator } from '../src/creators/entities/creator.entity';
import { Subscription, SubscriptionStatus } from '../src/subscriptions/entities/subscription.entity';
import { User } from '../src/users/entities/user.entity';

describe('SubscriptionsController (e2e)', () => {
  let app: INestApplication<unknown>;
  let userRepo: Repository<User>;
  let creatorRepo: Repository<Creator>;
  let subscriptionRepo: Repository<Subscription>;
  let fan: User;
  let creatorUser: User;
  let creator: Creator;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyAppConfig(app);
    await app.init();

    userRepo = moduleFixture.get(getRepositoryToken(User));
    creatorRepo = moduleFixture.get(getRepositoryToken(Creator));
    subscriptionRepo = moduleFixture.get(getRepositoryToken(Subscription));

    fan = userRepo.create({
      email: 'fan@test.com',
      username: 'fan',
      is_creator: false,
    });
    await userRepo.save(fan);

    creatorUser = userRepo.create({
      email: 'creator@test.com',
      username: 'creator',
      is_creator: true,
    });
    await userRepo.save(creatorUser);

    creator = creatorRepo.create({
      user: creatorUser,
      bio: 'Bio',
      subscription_price: '9.99',
      currency: 'USDC',
    });
    await creatorRepo.save(creator);
  });

  afterEach(async () => {
    await subscriptionRepo.clear();
    await creatorRepo.clear();
    await userRepo.clear();
    await app.close();
  });

  it('POST /subscriptions returns 401 without auth', () => {
    return request(app.getHttpServer())
      .post('/subscriptions')
      .send({ creator_id: creator.id })
      .expect(401);
  });

  it('fan can subscribe to creator via POST', () => {
    return request(app.getHttpServer())
      .post('/subscriptions')
      .set('X-User-Id', fan.id)
      .send({ creator_id: creator.id })
      .expect(201)
      .expect((res) => {
        expect(res.body).toMatchObject({
          status: SubscriptionStatus.ACTIVE,
          plan_id: null,
        });
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('started_at');
        expect(res.body).toHaveProperty('expires_at');
      });
  });

  it('duplicate subscription returns 409', async () => {
    await request(app.getHttpServer())
      .post('/subscriptions')
      .set('X-User-Id', fan.id)
      .send({ creator_id: creator.id })
      .expect(201);

    return request(app.getHttpServer())
      .post('/subscriptions')
      .set('X-User-Id', fan.id)
      .send({ creator_id: creator.id })
      .expect(409);
  });

  it('fan cannot subscribe to self (409)', () => {
    return request(app.getHttpServer())
      .post('/subscriptions')
      .set('X-User-Id', creatorUser.id)
      .send({ creator_id: creator.id })
      .expect(409);
  });

  it('fan can cancel own subscription; status becomes cancelled', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/subscriptions')
      .set('X-User-Id', fan.id)
      .send({ creator_id: creator.id })
      .expect(201);

    const subId = createRes.body.id;

    return request(app.getHttpServer())
      .delete(`/subscriptions/${subId}`)
      .set('X-User-Id', fan.id)
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe(SubscriptionStatus.CANCELLED);
      });
  });

  it('non-fan cannot cancel; returns 403', async () => {
    const otherUser = userRepo.create({
      email: 'other@test.com',
      username: 'other',
      is_creator: false,
    });
    await userRepo.save(otherUser);

    const createRes = await request(app.getHttpServer())
      .post('/subscriptions')
      .set('X-User-Id', fan.id)
      .send({ creator_id: creator.id })
      .expect(201);

    return request(app.getHttpServer())
      .delete(`/subscriptions/${createRes.body.id}`)
      .set('X-User-Id', otherUser.id)
      .expect(403);
  });

  it('returns 404 when subscription not found', () => {
    return request(app.getHttpServer())
      .delete('/subscriptions/00000000-0000-0000-0000-000000000000')
      .set('X-User-Id', fan.id)
      .expect(404);
  });

  it('POST /subscriptions/:id/cancel also cancels', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/subscriptions')
      .set('X-User-Id', fan.id)
      .send({ creator_id: creator.id })
      .expect(201);

    return request(app.getHttpServer())
      .post(`/subscriptions/${createRes.body.id}/cancel`)
      .set('X-User-Id', fan.id)
      .expect(201)
      .expect((res) => {
        expect(res.body.status).toBe(SubscriptionStatus.CANCELLED);
      });
  });
});
