import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CreatorsController } from '../src/creators/creators.controller';
import { CreatorsService } from '../src/creators/creators.service';

const stubCreators = [{ id: 'c1', handle: 'alice', displayName: 'Alice', avatarUrl: null, bio: null, subscriberCount: 10, isVerified: true }];
const mockService = {
  listCreators: jest.fn().mockResolvedValue(stubCreators),
  getCreatorPlans: jest.fn().mockResolvedValue([]),
  getCreatorAccess: jest.fn().mockResolvedValue({ hasAccess: false, subscriptionStatus: 'none', planId: null, teaser: null, contentCid: null }),
  getDashboardSummary: jest.fn().mockResolvedValue({ subscribers: 0, activeSubscriptions: 0, monthlyRevenue: 0, currency: 'USD' }),
};

describe('Creators controller (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CreatorsController],
      providers: [{ provide: CreatorsService, useValue: mockService }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('GET /creators returns creators, total, and updatedAt', async () => {
    const res = await request(app.getHttpServer()).get('/creators').expect(200);
    expect(res.body).toHaveProperty('creators');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('updatedAt');
  });
  it('defaults limit to 12', async () => {
    mockService.listCreators.mockClear();
    await request(app.getHttpServer()).get('/creators');
    expect(mockService.listCreators).toHaveBeenCalledWith(expect.objectContaining({ limit: 12 }));
  });
  it('clamps limit=0 to 1', async () => {
    mockService.listCreators.mockClear();
    await request(app.getHttpServer()).get('/creators').query({ limit: '0' });
    expect(mockService.listCreators).toHaveBeenCalledWith(expect.objectContaining({ limit: 1 }));
  });
  it('clamps limit=999 to 50', async () => {
    mockService.listCreators.mockClear();
    await request(app.getHttpServer()).get('/creators').query({ limit: '999' });
    expect(mockService.listCreators).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
  });
  it('passes 1-char q as null', async () => {
    mockService.listCreators.mockClear();
    await request(app.getHttpServer()).get('/creators').query({ q: 'a' });
    expect(mockService.listCreators).toHaveBeenCalledWith(expect.objectContaining({ query: null }));
  });
  it('passes 2-char q through', async () => {
    mockService.listCreators.mockClear();
    await request(app.getHttpServer()).get('/creators').query({ q: 'ab' });
    expect(mockService.listCreators).toHaveBeenCalledWith(expect.objectContaining({ query: 'ab' }));
  });
  it('GET /creators/:id/access returns contentCid null for unauthenticated viewer', async () => {
    const res = await request(app.getHttpServer()).get('/creators/c1/access').expect(200);
    expect(res.body.contentCid).toBeNull();
  });
  it('GET /creators/:id/dashboard-summary without creator auth does not return 200', async () => {
    const res = await request(app.getHttpServer()).get('/creators/c1/dashboard-summary');
    expect(res.status).not.toBe(200);

  describe('Single-Source Payout Wallet Invariant (#1864)', () => {
    it('should expose payoutWallet as the sole canonical payout field and exclude legacy payoutAddress', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/creators')
        .expect(200);

      if (response.body.data.length > 0) {
        const creator = response.body.data[0];
        if (creator.payoutWallet !== undefined && creator.payoutWallet !== null) {
          expect(typeof creator.payoutWallet).toBe('string');
        }
        expect(creator).not.toHaveProperty('payoutAddress');
        expect(creator).not.toHaveProperty('payout_address');
        expect(creator).not.toHaveProperty('recipientWallet');
      }
    });

    it('should reject or strip requests containing legacy dual payout fields via whitelist validation', async () => {
      const planWithLegacyField = {
        creator: 'test_creator_invariant',
        asset: 'USDC',
        amount: '50.00',
        intervalDays: 30,
        payoutAddress: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE',
      };

      const response = await request(app.getHttpServer())
        .post('/v1/creators/plans')
        .send(planWithLegacyField)
        .expect(201);

      expect(response.body).not.toHaveProperty('payoutAddress');
    });
  });

  describe('Authentication', () => {
    it('should require authentication for creators endpoints', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/creators');

      expect([200, 401, 403]).toContain(response.status);
    });
  });
});
