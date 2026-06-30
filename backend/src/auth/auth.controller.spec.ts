import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { WalletAuthService } from './wallet-auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Pick<AuthService, 'validateStellarAddress' | 'createSession'>>;
  let walletAuthService: jest.Mocked<Pick<WalletAuthService, 'createChallenge' | 'verifyAndIssueToken'>>;

  const validAddress = `G${'A'.repeat(55)}`;

  beforeEach(async () => {
    authService = {
      validateStellarAddress: jest.fn().mockReturnValue(true),
      createSession: jest.fn().mockResolvedValue({
        userId: validAddress,
        token: Buffer.from(validAddress).toString('base64'),
      }),
    };

    walletAuthService = {
      createChallenge: jest.fn().mockResolvedValue({
        nonce: 'abc123',
        expiresAt: new Date('2026-12-31'),
      }),
      verifyAndIssueToken: jest.fn().mockResolvedValue({
        access_token: 'jwt-token',
        token_type: 'Bearer',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'auth', ttl: 60000, limit: 5 }])],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: WalletAuthService, useValue: walletAuthService },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  describe('login', () => {
    it('creates a session for a valid address', async () => {
      const result = await controller.login({ address: validAddress });

      expect(authService.validateStellarAddress).toHaveBeenCalledWith(validAddress);
      expect(authService.createSession).toHaveBeenCalledWith(validAddress);
      expect(result).toEqual({
        userId: validAddress,
        token: expect.any(String),
      });
    });

    it('throws BadRequestException for invalid address', async () => {
      authService.validateStellarAddress.mockReturnValue(false);

      await expect(controller.login({ address: 'invalid' })).rejects.toThrow(
        BadRequestException,
      );
      expect(authService.createSession).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when address is omitted', async () => {
      authService.validateStellarAddress.mockReturnValue(false);

      await expect(controller.login({})).rejects.toThrow(BadRequestException);
    });

    it('throws on network mismatch', async () => {
      await expect(
        controller.login({ address: validAddress }, 'mainnet'),
      ).rejects.toThrow(HttpException);
    });

    it('passes when x-network matches server network', async () => {
      const result = await controller.login({ address: validAddress }, 'testnet');

      expect(result).toEqual({
        userId: validAddress,
        token: expect.any(String),
      });
    });

    it('ignores network header when not provided', async () => {
      const result = await controller.login({ address: validAddress }, undefined);

      expect(result).toEqual({
        userId: validAddress,
        token: expect.any(String),
      });
    });
  });

  describe('register (deprecated)', () => {
    it('creates a session for a valid address', async () => {
      const result = await controller.register({ address: validAddress });

      expect(authService.createSession).toHaveBeenCalledWith(validAddress);
      expect(result).toEqual({
        userId: validAddress,
        token: expect.any(String),
      });
    });

    it('throws BadRequestException for invalid address', async () => {
      authService.validateStellarAddress.mockReturnValue(false);

      await expect(controller.register({ address: 'bad' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws on network mismatch', async () => {
      await expect(
        controller.register({ address: validAddress }, 'mainnet'),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('requestChallenge', () => {
    it('returns nonce and expiry for a valid address', async () => {
      const result = await controller.requestChallenge({ address: validAddress });

      expect(authService.validateStellarAddress).toHaveBeenCalledWith(validAddress);
      expect(walletAuthService.createChallenge).toHaveBeenCalledWith(validAddress);
      expect(result).toEqual({
        nonce: 'abc123',
        expiresAt: expect.any(Date),
      });
    });

    it('throws BadRequestException for invalid address', async () => {
      authService.validateStellarAddress.mockReturnValue(false);

      await expect(
        controller.requestChallenge({ address: 'invalid' }),
      ).rejects.toThrow(BadRequestException);
      expect(walletAuthService.createChallenge).not.toHaveBeenCalled();
    });

    it('throws on network mismatch', async () => {
      await expect(
        controller.requestChallenge({ address: validAddress }, 'mainnet'),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('verifyChallenge', () => {
    const dto = { address: validAddress, nonce: 'abc123', signature: 'deadbeef' };

    it('returns JWT for valid verification', async () => {
      const result = await controller.verifyChallenge(dto);

      expect(walletAuthService.verifyAndIssueToken).toHaveBeenCalledWith(
        validAddress,
        'abc123',
        'deadbeef',
      );
      expect(result).toEqual({
        access_token: 'jwt-token',
        token_type: 'Bearer',
      });
    });

    it('throws BadRequestException for invalid address', async () => {
      authService.validateStellarAddress.mockReturnValue(false);

      await expect(controller.verifyChallenge(dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(walletAuthService.verifyAndIssueToken).not.toHaveBeenCalled();
    });

    it('throws on network mismatch', async () => {
      await expect(
        controller.verifyChallenge(dto, 'mainnet'),
      ).rejects.toThrow(HttpException);
    });

    it('propagates service errors', async () => {
      walletAuthService.verifyAndIssueToken.mockRejectedValue(
        new BadRequestException('Invalid signature'),
      );

      await expect(controller.verifyChallenge(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('assertNetworkMatch (via endpoints)', () => {
    it('accepts case-insensitive network match', async () => {
      const result = await controller.login({ address: validAddress }, 'Testnet');
      expect(result).toBeDefined();
    });

    it('trims whitespace from network header', async () => {
      const result = await controller.login({ address: validAddress }, '  testnet  ');
      expect(result).toBeDefined();
    });

    it('includes expected and current network in mismatch error', async () => {
      try {
        await controller.login({ address: validAddress }, 'mainnet');
        fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        const response = (e as HttpException).getResponse();
        expect(response).toMatchObject({
          error: 'NETWORK_MISMATCH',
          expectedNetwork: 'testnet',
          currentNetwork: 'mainnet',
        });
      }
    });
  });
});
