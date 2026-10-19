import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';

// Mock the Stellar SDK so no network calls are made.
jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...actual,
    Keypair: {
      ...actual.Keypair,
      fromPublicKey: jest.fn(),
    },
  };
});

import { Keypair } from '@stellar/stellar-sdk';

const VALID_PUBKEY =
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const MALFORMED_PUBKEY = 'not-a-valid-stellar-key';

const mockUserRepository = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(),
  decode: jest.fn(),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string, fallback?: unknown) => fallback),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('issueChallenge', () => {
    it('issues a challenge for a valid Stellar public key', async () => {
      (Keypair.fromPublicKey as jest.Mock).mockReturnValue({
        publicKey: () => VALID_PUBKEY,
      });

      const result = await service.issueChallenge(VALID_PUBKEY);

      expect(Keypair.fromPublicKey).toHaveBeenCalledWith(VALID_PUBKEY);
      expect(result).toBeDefined();
      expect(result.challenge).toBeDefined();
      expect(typeof result.challenge).toBe('string');
      expect(result.challenge).toContain(VALID_PUBKEY);
      expect(result.expiresAt).toBeDefined();
    });

    it('rejects a malformed public key', async () => {
      (Keypair.fromPublicKey as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid Stellar public key');
      });

      await expect(service.issueChallenge(MALFORMED_PUBKEY)).rejects.toThrow();
    });
  });

  describe('verifyChallenge', () => {
    it('verifies a valid signature and returns a token', async () => {
      (Keypair.fromPublicKey as jest.Mock).mockReturnValue({
        publicKey: () => VALID_PUBKEY,
        verify: jest.fn().mockReturnValue(true),
      });
      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-1',
        pubkey: VALID_PUBKEY,
        role: 'user',
      });
      mockJwtService.sign.mockReturnValue('signed.jwt.token');

      const result = await service.verifyChallenge(VALID_PUBKEY, 'valid-signature');

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(mockJwtService.sign).toHaveBeenCalled();
    });

    it('rejects an invalid signature', async () => {
      (Keypair.fromPublicKey as jest.Mock).mockReturnValue({
        publicKey: () => VALID_PUBKEY,
        verify: jest.fn().mockReturnValue(false),
      });

      await expect(
        service.verifyChallenge(VALID_PUBKEY, 'invalid-signature'),
      ).rejects.toThrow();
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('builds a JWT payload containing the user id and role claims', async () => {
      (Keypair.fromPublicKey as jest.Mock).mockReturnValue({
        publicKey: () => VALID_PUBKEY,
        verify: jest.fn().mockReturnValue(true),
      });
      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-1',
        pubkey: VALID_PUBKEY,
        role: 'admin',
      });
      mockJwtService.sign.mockReturnValue('signed.jwt.token');

      await service.verifyChallenge(VALID_PUBKEY, 'valid-signature');

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: VALID_PUBKEY,
          userId: 'user-1',
          role: 'admin',
        }),
      );
    });
  });
});
