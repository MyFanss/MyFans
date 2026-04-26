/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { INestApplication } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { SubscriptionsModule } from '../src/subscriptions/subscriptions.module';
import {
  SubscriptionIndexEntity,
  SubscriptionStatus,
} from '../src/subscriptions/entities/subscription-index.entity';
import {
  RPC_BALANCE_ADAPTER,
  RpcBalanceAdapter,
} from '../src/subscriptions/rpc-adapter';
import { SubscriptionEventPollerService } from '../src/subscriptions/services/subscription-event-poller.service';
import { GatedContentGuard } from '../src/subscriptions/gated-content.guard';

const mockedRPCAdapter: RpcBalanceAdapter = {
  getBalance: (fanAddress: string, assetCode: string) => {
    if (assetCode === 'XLM') return '100.0000000';
    if (assetCode === 'USDC') return '20.0000000';
    return '0.0000000';
  },
};

function makeSubscription(
  overrides: Partial<SubscriptionIndexEntity> = {},
): SubscriptionIndexEntity {
  return {
    id: 'sub-1',
    fan: 'GTESTFAN1',
    creator: 'GTESTCREATOR1',
    planId: 1,
    expiryUnix: Math.floor(Date.now() / 1000) + 3600,
    createdAt: new Date(),
    updatedAt: new Date(),
    indexedAt: new Date(),
    status: SubscriptionStatus.ACTIVE,
    ledgerSeq: -1,
    eventIndex: -1,
    eventType: 'manual',
    ...overrides,
  };
}

describe('SubscriptionsController (integration, RPC-mocked)', () => {
  let app: INestApplication;
  let currentSubs: SubscriptionIndexEntity[];
  const mockRepo = {
    create: jest.fn(
      (data: Partial<SubscriptionIndexEntity>) =>
        makeSubscription(data as Partial<SubscriptionIndexEntity>),
    ),
    save: jest.fn(async (entity: SubscriptionIndexEntity) => {
      const existingIndex = currentSubs.findIndex(
        (sub) => sub.fan === entity.fan && sub.creator === entity.creator,
      );
      const next = makeSubscription({
        ...entity,
        id: existingIndex >= 0 ? currentSubs[existingIndex].id : entity.id,
      });
      if (existingIndex >= 0) {
        currentSubs[existingIndex] = next;
      } else {
        currentSubs.push(next);
      }
      return next;
    }),
    findOne: jest.fn(
      async ({
        where,
      }: {
        where: Partial<SubscriptionIndexEntity>;
      }) =>
        currentSubs.find((sub) =>
          Object.entries(where).every(
            ([key, value]) => sub[key as keyof SubscriptionIndexEntity] === value,
          ),
        ) ?? null,
    ),
    findAndCount: jest.fn(
      async ({
        where,
        skip = 0,
        take = currentSubs.length,
      }: {
        where?: Partial<SubscriptionIndexEntity>;
        skip?: number;
        take?: number;
      }) => {
        const filtered = currentSubs.filter((sub) =>
          Object.entries(where ?? {}).every(
            ([key, value]) => sub[key as keyof SubscriptionIndexEntity] === value,
          ),
        );
        return [filtered.slice(skip, skip + take), filtered.length];
      },
    ),
    find: jest.fn(
      async ({
        where,
      }: {
        where?: Partial<SubscriptionIndexEntity>;
      } = {}) =>
        currentSubs.filter((sub) =>
          Object.entries(where ?? {}).every(
            ([key, value]) => sub[key as keyof SubscriptionIndexEntity] === value,
          ),
        ),
    ),
    update: jest.fn(
      async (
        criteria: Partial<SubscriptionIndexEntity>,
        partial: Partial<SubscriptionIndexEntity>,
      ) => {
        currentSubs = currentSubs.map((sub) =>
          Object.entries(criteria).every(
            ([key, value]) => sub[key as keyof SubscriptionIndexEntity] === value,
          )
            ? makeSubscription({ ...sub, ...partial })
            : sub,
        );
      },
    ),
    createQueryBuilder: jest.fn((alias: string) => {
      const state = {
        fan: undefined as string | undefined,
        status: undefined as SubscriptionStatus | undefined,
        skip: 0,
        take: currentSubs.length,
      };
      const builder = {
        where: (query: string, params: { fan: string }) => {
          if (query.includes(`${alias}.fan = :fan`)) {
            state.fan = params.fan;
          }
          return builder;
        },
        andWhere: (_query: string, params: { active: SubscriptionStatus }) => {
          state.status = params.active;
          return builder;
        },
        orderBy: () => builder,
        skip: (value: number) => {
          state.skip = value;
          return builder;
        },
        take: (value: number) => {
          state.take = value;
          return builder;
        },
        select: () => builder,
        getRawOne: async () => ({
          maxLedger:
            currentSubs.reduce((max, sub) => Math.max(max, sub.ledgerSeq), 0) || 0,
        }),
        getMany: async () => {
          const filtered = currentSubs.filter(
            (sub) =>
              (state.fan ? sub.fan === state.fan : true) &&
              (state.status ? sub.status === state.status : true),
          );
          return filtered.slice(state.skip, state.skip + state.take);
        },
      };
      return builder;
    }),
  };

  beforeEach(async () => {
    currentSubs = [];
    jest.clearAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ScheduleModule.forRoot(), SubscriptionsModule],
    })
      .overrideProvider(getRepositoryToken(SubscriptionIndexEntity))
      .useValue(mockRepo)
      .overrideProvider(SubscriptionEventPollerService)
      .useValue({
        onModuleInit: jest.fn(),
        poll: jest.fn(),
      })
      .overrideProvider(GatedContentGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideProvider(RPC_BALANCE_ADAPTER)
      .useValue(mockedRPCAdapter)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('creates checkout and powers the full flow via RPC stubs', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/subscriptions/checkout')
      .send({
        fanAddress: 'GTESTFAN1',
        creatorAddress: 'GTESTCREATOR1',
        planId: 1,
      })
      .expect(201);

    expect(createRes.body).toHaveProperty('id');
    expect(createRes.body.status).toBe('pending');

    const checkoutId = createRes.body.id;

    await request(app.getHttpServer())
      .get(`/subscriptions/checkout/${checkoutId}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(checkoutId);
        expect(res.body.fanAddress).toBe('GTESTFAN1');
      });

    await request(app.getHttpServer())
      .get(`/subscriptions/checkout/${checkoutId}/plan`)
      .expect(200)
      .expect((res) => {
        expect(res.body.creatorAddress).toBe('GAAAAAAAAAAAAAAA');
        expect(res.body.assetCode).toBe('XLM');
      });

    await request(app.getHttpServer())
      .get(`/subscriptions/checkout/${checkoutId}/price`)
      .expect(200)
      .expect((res) => {
        expect(res.body.subtotal).toBe('10');
        expect(res.body.platformFee).toBeDefined();
      });

    await request(app.getHttpServer())
      .get(`/subscriptions/checkout/${checkoutId}/wallet`)
      .expect(200)
      .expect((res) => {
        const xlm = res.body.balances.find((b) => b.code === 'XLM');
        const usdc = res.body.balances.find((b) => b.code === 'USDC');

        expect(xlm.balance).toBe('100.0000000');
        expect(usdc.balance).toBe('20.0000000');
      });

    await request(app.getHttpServer())
      .post(`/subscriptions/checkout/${checkoutId}/validate`)
      .send({ assetCode: 'XLM', amount: '10' })
      .expect(201)
      .expect((res) => {
        expect(res.body.valid).toBe(true);
      });

    await request(app.getHttpServer())
      .post(`/subscriptions/checkout/${checkoutId}/validate`)
      .send({ assetCode: 'USDC', amount: '50' })
      .expect(201)
      .expect((res) => {
        expect(res.body.valid).toBe(false);
        expect(res.body).toHaveProperty('shortfall');
      });

    await request(app.getHttpServer())
      .get('/subscriptions/check')
      .query({ fan: 'GTESTFAN1', creator: 'GTESTCREATOR1' })
      .expect(200)
      .expect((res) => {
        expect(res.body.isSubscriber).toBe(false);
      });

    await request(app.getHttpServer())
      .post(`/subscriptions/checkout/${checkoutId}/confirm`)
      .send({ txHash: 'tx-101' })
      .expect(201)
      .expect((res) => {
        expect(res.body.status).toBe('completed');
        expect(res.body.txHash).toBe('tx-101');
      });

    await request(app.getHttpServer())
      .get('/subscriptions/check')
      .query({ fan: 'GTESTFAN1', creator: 'GTESTCREATOR1' })
      .expect(200)
      .expect((res) => {
        expect(res.body.isSubscriber).toBe(true);
      });

    // confirmation has side effects on the checkout record
    await request(app.getHttpServer())
      .get(`/subscriptions/checkout/${checkoutId}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('completed');
        expect(res.body.txHash).toBe('tx-101');
      });
  });

  it('handles failed checkout path', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/subscriptions/checkout')
      .send({
        fanAddress: 'GTESTFAN2',
        creatorAddress: 'GTESTCREATOR2',
        planId: 1,
      })
      .expect(201);

    const checkoutId = createRes.body.id;

    await request(app.getHttpServer())
      .post(`/subscriptions/checkout/${checkoutId}/fail`)
      .send({ error: 'Insufficient funds' })
      .expect(201)
      .expect((res) => {
        expect(res.body.status).toBe('failed');
      });

    await request(app.getHttpServer())
      .get(`/subscriptions/checkout/${checkoutId}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('failed');
      });
  });
});
