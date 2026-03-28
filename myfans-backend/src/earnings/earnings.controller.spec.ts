import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
import { EarningsController } from './earnings.controller';
import { EarningsService } from './earnings.service';
import { AuthGuard } from '../auth/auth.guard';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';

const mockEarningsService = {
  getEarningsSummary: jest.fn(),
  getEarningsBreakdown: jest.fn(),
  getTransactionHistory: jest.fn(),
  getWithdrawalHistory: jest.fn(),
  requestWithdrawal: jest.fn(),
  getFeeTransparency: jest.fn(),
};

// Mock user repository — returns null for any user lookup (simulates no valid user)
const mockUserRepository = {
  findOne: jest.fn().mockResolvedValue(null),
};

describe('EarningsController — auth guard (unauthenticated requests)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EarningsController],
      providers: [
        { provide: EarningsService, useValue: mockEarningsService },
        AuthGuard,
        Reflector,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /earnings/summary without auth returns 401', () => {
    return request(app.getHttpServer())
      .get('/earnings/summary')
      .expect(401);
  });

  it('GET /earnings/breakdown without auth returns 401', () => {
    return request(app.getHttpServer())
      .get('/earnings/breakdown')
      .expect(401);
  });

  it('GET /earnings/transactions without auth returns 401', () => {
    return request(app.getHttpServer())
      .get('/earnings/transactions')
      .expect(401);
  });

  it('GET /earnings/withdrawals without auth returns 401', () => {
    return request(app.getHttpServer())
      .get('/earnings/withdrawals')
      .expect(401);
  });

  it('POST /earnings/withdraw without auth returns 401', () => {
    return request(app.getHttpServer())
      .post('/earnings/withdraw')
      .send({ amount: '10', currency: 'USD', method: 'bank', destination_address: 'addr' })
      .expect(401);
  });
});
