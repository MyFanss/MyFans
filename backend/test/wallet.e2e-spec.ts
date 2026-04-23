/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  INestApplication,
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

// ---------------------------------------------------------------------------
// In-memory store so challenge/verify round-trips work end-to-end
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VALID_ADDRESS =
  'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';

describe('Wallet Auth Endpoints (integration)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
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
    mockChallengeRepo.create.mockImplementation(
      (data: Partial<WalletChallenge>) => ({ ...data }) as WalletChallenge,
    );
    mockChallengeRepo.save.mockImplementation((entity: WalletChallenge) => {
      challengeStore.set(entity.nonce, entity);
      return Promise.resolve(entity);
    });
    mockChallengeRepo.findOne.mockImplementation(
      ({ where }: { where: { stellarAddress: string; nonce: string } }) =>
        Promise.resolve(challengeStore.get(where.nonce) ?? null),
    );
    mockJwtService.sign.mockReturnValue('mock-jwt-token');
  });

  // =========================================================================
  // POST /v1/auth/login  (wallet connect — simple session)
  // =========================================================================
  describe('POST /v1/auth/login', () => {
    it('returns a session token for a valid Stellar address', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ address: VALID_ADDRESS })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('userId', VALID_ADDRESS);
          expect(res.body).toHaveProperty('token');
          expect(typeof res.body.token).toBe('string');
        });
    });

    it('token is the base64-encoded address', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ address: VALID_ADDRESS })
        .expect(201)
        .expect((res) => {
          const decoded = Buffer.from(
            String(res.body.token),
            'base64',
          ).toString();
          expect(decoded).toBe(VALID_ADDRESS);
        });
    });

    it('rejects an address that does not start with G', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          address: 'XBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid Stellar address');
        });
    });

    it('rejects an address with wrong length', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ address: 'GSHORT' })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid Stellar address');
        });
    });

    it('rejects an empty address', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ address: '' })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid Stellar address');
        });
    });

    it('rejects a missing address field', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({})
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid Stellar address');
        });
    });
  });

  // =========================================================================
  // POST /v1/auth/challenge  (request nonce)
  // =========================================================================
  describe('POST /v1/auth/challenge', () => {
    it('returns a nonce and expiry for a valid address', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/challenge')
        .send({ address: VALID_ADDRESS })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('nonce');
          expect(typeof res.body.nonce).toBe('string');
          expect(res.body.nonce.length).toBeGreaterThan(0);
          expect(res.body).toHaveProperty('expiresAt');
          expect(
            new Date(String(res.body.expiresAt)).getTime(),
          ).toBeGreaterThan(Date.now());
        });
    });

    it('persists the challenge (repo.create and repo.save called)', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/challenge')
        .send({ address: VALID_ADDRESS })
        .expect(200);

      expect(mockChallengeRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ stellarAddress: VALID_ADDRESS }),
      );
      expect(mockChallengeRepo.save).toHaveBeenCalled();
    });

    it('rejects an invalid address', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/challenge')
        .send({ address: 'not-a-stellar-address' })
        .expect(400);
    });

    it('rejects a missing address', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/challenge')
        .send({})
        .expect(400);
    });
  });

  // =========================================================================
  // POST /v1/auth/challenge/verify  (verify signature → JWT)
  // =========================================================================
  describe('POST /v1/auth/challenge/verify', () => {
    it('issues a JWT for a valid signature (full round-trip)', async () => {
      const keypair = Keypair.random();
      const address = keypair.publicKey();

      // Request challenge
      const challengeRes = await request(app.getHttpServer())
        .post('/v1/auth/challenge')
        .send({ address })
        .expect(200);

      const { nonce } = challengeRes.body as { nonce: string };

      // Sign the nonce
      const sig = keypair.sign(Buffer.from(nonce, 'utf8'));
      const sigHex = Buffer.from(sig).toString('hex');

      // Verify
      return request(app.getHttpServer())
        .post('/v1/auth/challenge/verify')
        .send({ address, nonce, signature: sigHex })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('access_token', 'mock-jwt-token');
          expect(res.body).toHaveProperty('token_type', 'Bearer');
        });
    });

    it('rejects a replayed (already-used) challenge', async () => {
      const keypair = Keypair.random();
      const address = keypair.publicKey();

      const challengeRes = await request(app.getHttpServer())
        .post('/v1/auth/challenge')
        .send({ address })
        .expect(200);

      const { nonce } = challengeRes.body as { nonce: string };
      const sig = keypair.sign(Buffer.from(nonce, 'utf8'));
      const sigHex = Buffer.from(sig).toString('hex');

      // First verify — succeeds
      await request(app.getHttpServer())
        .post('/v1/auth/challenge/verify')
        .send({ address, nonce, signature: sigHex })
        .expect(200);

      // Second verify — replay rejected
      return request(app.getHttpServer())
        .post('/v1/auth/challenge/verify')
        .send({ address, nonce, signature: sigHex })
        .expect(401);
    });

    it('rejects an expired challenge', async () => {
      const keypair = Keypair.random();
      const address = keypair.publicKey();
      const nonce = 'expired-nonce';

      // Seed an already-expired challenge directly into the store
      challengeStore.set(nonce, {
        id: 'id-expired',
        stellarAddress: address,
        nonce,
        expiresAt: new Date(Date.now() - 1000),
        used: false,
        createdAt: new Date(),
      } as WalletChallenge);

      const sig = keypair.sign(Buffer.from(nonce, 'utf8'));
      const sigHex = Buffer.from(sig).toString('hex');

      return request(app.getHttpServer())
        .post('/v1/auth/challenge/verify')
        .send({ address, nonce, signature: sigHex })
        .expect(401);
    });

    it('rejects a challenge that does not exist', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/challenge/verify')
        .send({
          address: VALID_ADDRESS,
          nonce: 'no-such-nonce',
          signature: 'aabb',
        })
        .expect(401);
    });

    it('rejects an invalid (bad) signature', async () => {
      const keypair = Keypair.random();
      const address = keypair.publicKey();

      const challengeRes = await request(app.getHttpServer())
        .post('/v1/auth/challenge')
        .send({ address })
        .expect(200);

      const { nonce } = challengeRes.body as { nonce: string };
      const badSig = Buffer.alloc(64, 0).toString('hex');

      return request(app.getHttpServer())
        .post('/v1/auth/challenge/verify')
        .send({ address, nonce, signature: badSig })
        .expect(400);
    });

    it('rejects an invalid address in verify', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/challenge/verify')
        .send({ address: 'BADINPUT', nonce: 'n', signature: 's' })
        .expect(400);
    });
  });

  // =========================================================================
  // POST /v1/auth/register  (deprecated alias — still works)
  // =========================================================================
  describe('POST /v1/auth/register (deprecated)', () => {
    it('returns a session token (same as /login)', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ address: VALID_ADDRESS })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('userId', VALID_ADDRESS);
          expect(res.body).toHaveProperty('token');
        });
    });

    it('sets Deprecation and Sunset headers', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ address: VALID_ADDRESS })
        .expect(201)
        .expect((res) => {
          expect(res.headers).toHaveProperty('deprecation');
          expect(res.headers).toHaveProperty('sunset');
        });
    });

    it('rejects an invalid address', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ address: 'INVALID' })
        .expect(400);
    });
  });
});
