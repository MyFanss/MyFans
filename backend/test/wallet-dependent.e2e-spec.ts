/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  INestApplication,
  Post,
  UseGuards,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Keypair } from '@stellar/stellar-sdk';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthModule } from '../src/auth/auth.module';
import { WalletChallenge } from '../src/auth/wallet-challenge.entity';
import { FanBearerGuard } from '../src/subscriptions/guards/fan-bearer.guard';
import { EventBus } from '../src/events/event-bus';
import { SubscriptionsService } from '../src/subscriptions/subscriptions.service';
import { SubscriptionIndexRepository } from '../src/subscriptions/repositories/subscription-index.repository';

const VALID_ADDRESS =
  'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';

const challengeStore = new Map<string, WalletChallenge>();

const mockChallengeRepo = {
  create: jest.fn(
    (data: Partial<WalletChallenge>) => ({ ...data }) as WalletChallenge,
  ),
  save: jest.fn((entity: WalletChallenge) => {
    challengeStore.set(entity.nonce, entity);
    return Promise.resolve(entity);
  }),
  findOne: jest.fn(
    ({ where }: { where: { stellarAddress: string; nonce: string } }) =>
      Promise.resolve(challengeStore.get(where.nonce) ?? null),
  ),
};

const mockJwtService = {
  sign: jest.fn(() => 'mock-jwt-token'),
  verify: jest.fn(),
};

@Controller({ path: 'subscriptions', version: '1' })
class WalletDependentStubController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('me/list')
  @UseGuards(FanBearerGuard)
  listForConnectedFan() {
    return { data: [], limit: 20, nextCursor: null, hasMore: false };
  }

  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  @Header('content-type', 'application/json')
  createCheckout(@Headers('x-network') network?: string) {
    const checkout = this.subscriptionsService.createCheckout(
      VALID_ADDRESS,
      'GAAAAAAAAAAAAAAA',
      1,
      'XLM',
      undefined,
      network,
    );
    return { id: checkout.id };
  }
}

describe('Wallet-dependent endpoints (integration)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
      controllers: [WalletDependentStubController],
      providers: [
        FanBearerGuard,
        SubscriptionsService,
        { provide: SubscriptionIndexRepository, useValue: {} },
        { provide: EventBus, useValue: { publish: jest.fn() } },
      ],
    })
      .overrideProvider(ConfigService)
      .useValue({
        getOrThrow: () => 'test-jwt-secret',
        get: () => 'test-jwt-secret',
      })
      .overrideProvider(getRepositoryToken(WalletChallenge))
      .useValue(mockChallengeRepo)
      .overrideProvider(JwtService)
      .useValue(mockJwtService)
      .compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    challengeStore.clear();
    jest.clearAllMocks();
    mockJwtService.sign.mockReturnValue('mock-jwt-token');
  });

  describe('wallet connect', () => {
    it('returns a session token for a valid address and signature', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ address: VALID_ADDRESS })
        .expect(201);

      expect(loginRes.body).toMatchObject({
        userId: VALID_ADDRESS,
        token: expect.any(String),
      });

      const keypair = Keypair.random();
      const address = keypair.publicKey();
      const challengeRes = await request(app.getHttpServer())
        .post('/v1/auth/challenge')
        .send({ address })
        .expect(200);

      const { nonce } = challengeRes.body as { nonce: string };
      const sigHex = Buffer.from(keypair.sign(Buffer.from(nonce, 'utf8'))).toString(
        'hex',
      );

      await request(app.getHttpServer())
        .post('/v1/auth/challenge/verify')
        .send({ address, nonce, signature: sigHex })
        .expect(200)
        .expect((res) => {
          expect(res.body).toMatchObject({
            access_token: 'mock-jwt-token',
            token_type: 'Bearer',
          });
        });
    });

    it('returns a clear error when signature is missing', async () => {
      const keypair = Keypair.random();
      const address = keypair.publicKey();

      const challengeRes = await request(app.getHttpServer())
        .post('/v1/auth/challenge')
        .send({ address })
        .expect(200);

      const { nonce } = challengeRes.body as { nonce: string };

      await request(app.getHttpServer())
        .post('/v1/auth/challenge/verify')
        .send({ address, nonce })
        .expect(400);
    });

    it('returns a clear error when signature is invalid', async () => {
      const keypair = Keypair.random();
      const address = keypair.publicKey();

      const challengeRes = await request(app.getHttpServer())
        .post('/v1/auth/challenge')
        .send({ address })
        .expect(200);

      const { nonce } = challengeRes.body as { nonce: string };

      await request(app.getHttpServer())
        .post('/v1/auth/challenge/verify')
        .send({
          address,
          nonce,
          signature: Buffer.alloc(64, 0).toString('hex'),
        })
        .expect(400);
    });
  });

  describe('wallet disconnect', () => {
    it('denies wallet-dependent access after the client clears the session token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ address: VALID_ADDRESS })
        .expect(201);

      const token = String(loginRes.body.token);

      await request(app.getHttpServer())
        .get('/v1/subscriptions/me/list')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/v1/subscriptions/me/list')
        .expect(401)
        .expect((res) => {
          expect(String(res.body.message)).toMatch(/Authorization/i);
        });
    });
  });

  describe('wallet-dependent routes', () => {
    it('fails with a clear error when wallet is not connected', async () => {
      await request(app.getHttpServer())
        .get('/v1/subscriptions/me/list')
        .expect(401)
        .expect((res) => {
          expect(String(res.body.message)).toMatch(/Authorization/i);
        });
    });

    it('succeeds when a wallet session token is present', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ address: VALID_ADDRESS })
        .expect(201);

      await request(app.getHttpServer())
        .get('/v1/subscriptions/me/list')
        .set('Authorization', `Bearer ${String(loginRes.body.token)}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toMatchObject({
            data: [],
            hasMore: false,
            nextCursor: null,
          });
        });
    });
  });

  describe('wrong network / chain mismatch', () => {
    it('rejects when x-network does not match the server network', async () => {
      await request(app.getHttpServer())
        .post('/v1/subscriptions/checkout')
        .set('x-network', 'mainnet')
        .send({})
        .expect(400)
        .expect((res) => {
          expect(res.body).toMatchObject({
            error: 'NETWORK_MISMATCH',
          });
        });
    });
  });
});
