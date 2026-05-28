import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Keypair } from '@stellar/stellar-sdk';
import { WalletAuthService } from './wallet-auth.service';
import { WalletChallenge } from './wallet-challenge.entity';
import { EventBus } from '../events/event-bus';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
});

describe('WalletAuthService', () => {
  let service: WalletAuthService;
  let repo: ReturnType<typeof mockRepo>;
  let jwtService: { sign: jest.Mock };

  const keypair = Keypair.random();
  const address = keypair.publicKey();

  beforeEach(async () => {
    repo = mockRepo();
    jwtService = { sign: jest.fn().mockReturnValue('jwt-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletAuthService,
        { provide: getRepositoryToken(WalletChallenge), useValue: repo },
        { provide: JwtService, useValue: jwtService },
        { provide: EventBus, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    service = module.get(WalletAuthService);
  });

  describe('createChallenge', () => {
    it('persists and returns a nonce with expiry', async () => {
      const entity = { nonce: 'abc', expiresAt: new Date() };
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      const result = await service.createChallenge(address);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ stellarAddress: address }),
      );
      expect(result).toHaveProperty('nonce');
      expect(result).toHaveProperty('expiresAt');
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('verifyAndIssueToken', () => {
    const buildChallenge = (overrides: Partial<WalletChallenge> = {}): WalletChallenge =>
      ({
        id: 'id-1',
        stellarAddress: address,
        nonce: 'test-nonce',
        expiresAt: new Date(Date.now() + 60_000),
        used: false,
        createdAt: new Date(),
        ...overrides,
      } as WalletChallenge);

    it('issues a JWT for a valid signature', async () => {
      const nonce = 'test-nonce';
      const sig = keypair.sign(Buffer.from(nonce, 'utf8'));
      const sigHex = Buffer.from(sig).toString('hex');

      repo.findOne.mockResolvedValue(buildChallenge({ nonce }));
      repo.save.mockResolvedValue({});

      const result = await service.verifyAndIssueToken(address, nonce, sigHex);

      expect(result.access_token).toBe('jwt-token');
      expect(result.token_type).toBe('Bearer');
    });

    it('rejects a replayed (used) challenge', async () => {
      repo.findOne.mockResolvedValue(buildChallenge({ used: true }));

      await expect(
        service.verifyAndIssueToken(address, 'nonce', 'sig'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an expired challenge', async () => {
      repo.findOne.mockResolvedValue(
        buildChallenge({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(
        service.verifyAndIssueToken(address, 'nonce', 'sig'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a challenge not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.verifyAndIssueToken(address, 'nonce', 'sig'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an invalid signature', async () => {
      const nonce = 'test-nonce';
      const badSig = Buffer.alloc(64, 0).toString('hex');

      repo.findOne.mockResolvedValue(buildChallenge({ nonce }));

      await expect(
        service.verifyAndIssueToken(address, nonce, badSig),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
