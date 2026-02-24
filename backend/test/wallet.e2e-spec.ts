/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthModule } from './../src/auth/auth.module';
import { SubscriptionsModule } from './../src/subscriptions/subscriptions.module';

describe('Wallet Endpoints (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthModule, SubscriptionsModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // ==================== Wallet Connect (POST /auth/login) ====================

  describe('POST /auth/login (wallet connect)', () => {
    const validAddress =
      'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';

    it('should create session with valid Stellar address', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ address: validAddress })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('userId', validAddress);
          expect(res.body).toHaveProperty('token');
          expect(typeof res.body.token).toBe('string');
        });
    });

    it('should return token as base64-encoded address', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ address: validAddress })
        .expect(201)
        .expect((res) => {
          const decoded = Buffer.from(
            String(res.body.token),
            'base64',
          ).toString();
          expect(decoded).toBe(validAddress);
        });
    });

    it('should reject address not starting with G', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          address: 'XBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('error', 'Invalid Stellar address');
        });
    });

    it('should reject address with wrong length', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ address: 'GBRPYHIL2CI3FNQ4' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('error', 'Invalid Stellar address');
        });
    });

    it('should reject empty address', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ address: '' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('error', 'Invalid Stellar address');
        });
    });

    it('should error when address field is missing', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(500);
    });
  });

  // ==================== Wallet Status ====================

  describe('GET /subscriptions/checkout/:id/wallet', () => {
    let checkoutId: string;
    const fanAddress =
      'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/subscriptions/checkout')
        .send({
          fanAddress,
          creatorAddress: 'GAAAAAAAAAAAAAAA',
          planId: 1,
        });
      checkoutId = res.body.id;
    });

    it('should return wallet status with balances', () => {
      return request(app.getHttpServer())
        .get(`/subscriptions/checkout/${checkoutId}/wallet`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('address', fanAddress);
          expect(res.body).toHaveProperty('isConnected', true);
          expect(Array.isArray(res.body.balances)).toBe(true);
          expect(res.body.balances.length).toBeGreaterThan(0);
        });
    });

    it('should include XLM and USDC balances', () => {
      return request(app.getHttpServer())
        .get(`/subscriptions/checkout/${checkoutId}/wallet`)
        .expect(200)
        .expect((res) => {
          const codes = res.body.balances.map((b: { code: string }) => b.code);
          expect(codes).toContain('XLM');
          expect(codes).toContain('USDC');
        });
    });

    it('should return 404 for non-existent checkout', () => {
      return request(app.getHttpServer())
        .get('/subscriptions/checkout/non-existent-id/wallet')
        .expect(404);
    });
  });

  // ==================== Balance Validation ====================

  describe('POST /subscriptions/checkout/:id/validate', () => {
    let checkoutId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/subscriptions/checkout')
        .send({
          fanAddress:
            'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
          creatorAddress: 'GAAAAAAAAAAAAAAA',
          planId: 1,
        });
      checkoutId = res.body.id;
    });

    it('should validate sufficient balance', () => {
      return request(app.getHttpServer())
        .post(`/subscriptions/checkout/${checkoutId}/validate`)
        .send({ assetCode: 'XLM', amount: '10' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('valid', true);
          expect(res.body).toHaveProperty('balance');
        });
    });

    it('should reject insufficient balance', () => {
      return request(app.getHttpServer())
        .post(`/subscriptions/checkout/${checkoutId}/validate`)
        .send({ assetCode: 'XLM', amount: '99999' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('valid', false);
          expect(res.body).toHaveProperty('shortfall');
        });
    });

    it('should return zero balance for unsupported asset', () => {
      return request(app.getHttpServer())
        .post(`/subscriptions/checkout/${checkoutId}/validate`)
        .send({ assetCode: 'FAKE', amount: '1' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('valid', false);
        });
    });
  });

  // ==================== Transaction Confirm (wallet success path) ====================

  describe('POST /subscriptions/checkout/:id/confirm', () => {
    let checkoutId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/subscriptions/checkout')
        .send({
          fanAddress:
            'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
          creatorAddress: 'GAAAAAAAAAAAAAAA',
          planId: 1,
        });
      checkoutId = res.body.id;
    });

    it('should confirm subscription with txHash', () => {
      return request(app.getHttpServer())
        .post(`/subscriptions/checkout/${checkoutId}/confirm`)
        .send({ txHash: 'abc123def456' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('txHash', 'abc123def456');
          expect(res.body).toHaveProperty('explorerUrl');
          expect(res.body.explorerUrl).toContain('stellar.expert');
        });
    });

    it('should generate txHash when not provided', () => {
      return request(app.getHttpServer())
        .post(`/subscriptions/checkout/${checkoutId}/confirm`)
        .send({})
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('txHash');
          expect(res.body.txHash).toMatch(/^tx_/);
        });
    });
  });

  // ==================== Transaction Fail (wallet error/disconnect paths) ====================

  describe('POST /subscriptions/checkout/:id/fail', () => {
    let checkoutId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/subscriptions/checkout')
        .send({
          fanAddress:
            'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
          creatorAddress: 'GAAAAAAAAAAAAAAA',
          planId: 1,
        });
      checkoutId = res.body.id;
    });

    it('should handle transaction failure', () => {
      return request(app.getHttpServer())
        .post(`/subscriptions/checkout/${checkoutId}/fail`)
        .send({ error: 'Transaction timeout' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', false);
          expect(res.body).toHaveProperty('status', 'failed');
          expect(res.body).toHaveProperty('error', 'Transaction timeout');
        });
    });

    it('should handle wallet rejection (user disconnect)', () => {
      return request(app.getHttpServer())
        .post(`/subscriptions/checkout/${checkoutId}/fail`)
        .send({ error: 'User rejected transaction', rejected: true })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', false);
          expect(res.body).toHaveProperty('status', 'rejected');
        });
    });

    it('should return 404 for non-existent checkout', () => {
      return request(app.getHttpServer())
        .post('/subscriptions/checkout/bad-id/fail')
        .send({ error: 'fail' })
        .expect(404);
    });
  });

  // ==================== Checkout Creation Errors ====================

  describe('POST /subscriptions/checkout (error paths)', () => {
    it('should reject checkout for non-existent plan', () => {
      return request(app.getHttpServer())
        .post('/subscriptions/checkout')
        .send({
          fanAddress:
            'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
          creatorAddress: 'GAAAAAAAAAAAAAAA',
          planId: 999,
        })
        .expect(404);
    });
  });
});
