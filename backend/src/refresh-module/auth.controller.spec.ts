import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { RefreshTokenService } from './refresh-token.service';
import { RefreshTokenDto, LogoutDto } from './refresh-token.dto';

const mockTokenPair = {
  access_token: 'new-access-jwt',
  refresh_token: 'new-raw-refresh',
  token_type: 'Bearer',
  expires_in: 900,
  userId: 'user-uuid',
  email: 'test@example.com',
};

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<RefreshTokenService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: RefreshTokenService,
          useValue: {
            rotate: jest.fn(),
            invalidate: jest.fn(),
            invalidateAll: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
    service = module.get(RefreshTokenService);
  });

  // ── POST /auth/refresh ───────────────────────────────────────────────────

  describe('refresh', () => {
    it('returns new token pair for a valid refresh token', async () => {
      service.rotate.mockResolvedValue(mockTokenPair);
      const dto: RefreshTokenDto = { refresh_token: 'valid-raw' };

      const result = await controller.refresh(dto);

      expect(service.rotate).toHaveBeenCalledWith('valid-raw');
      expect(result).toEqual({
        access_token: 'new-access-jwt',
        refresh_token: 'new-raw-refresh',
        token_type: 'Bearer',
        expires_in: 900,
      });
      // userId / email should NOT be exposed to the client
      expect((result as any).userId).toBeUndefined();
      expect((result as any).email).toBeUndefined();
    });

    it('propagates 401 when service throws UnauthorizedException', async () => {
      service.rotate.mockRejectedValue(new UnauthorizedException('Invalid refresh token'));
      const dto: RefreshTokenDto = { refresh_token: 'bad-token' };

      await expect(controller.refresh(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── POST /auth/logout ────────────────────────────────────────────────────

  describe('logout', () => {
    const mockReq = { user: { userId: 'user-uuid' } };

    it('invalidates a single token when all_devices is falsy', async () => {
      service.invalidate.mockResolvedValue(undefined);
      const dto: LogoutDto = { refresh_token: 'raw-token' };

      await controller.logout(dto, mockReq);

      expect(service.invalidate).toHaveBeenCalledWith('raw-token');
      expect(service.invalidateAll).not.toHaveBeenCalled();
    });

    it('invalidates all tokens when all_devices is true', async () => {
      service.invalidateAll.mockResolvedValue(undefined);
      const dto: LogoutDto = { refresh_token: 'raw-token', all_devices: true };

      await controller.logout(dto, mockReq);

      expect(service.invalidateAll).toHaveBeenCalledWith('user-uuid');
      expect(service.invalidate).not.toHaveBeenCalled();
    });
  });
});
