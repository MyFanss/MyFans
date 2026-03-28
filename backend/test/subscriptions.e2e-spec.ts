import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { SubscriptionsModule } from '../src/subscriptions/subscriptions.module';
import {
  RPC_BALANCE_ADAPTER,
  RpcBalanceAdapter,
} from '../src/subscriptions/rpc-adapter';

const mockedRPCAdapter: RpcBalanceAdapter = {
  getBalance: (fanAddress: string, assetCode: string) => {
    if (assetCode === 'XLM') return '100.0000000';
    if (assetCode === 'USDC') return '20.0000000';
    return '0.0000000';
  },
};

describe('SubscriptionsController (integration, RPC-mocked)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [SubscriptionsModule],
    })
      .overrideProvider(RPC_BALANCE_ADAPTER)
      .useValue(mockedRPCAdapter)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
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
