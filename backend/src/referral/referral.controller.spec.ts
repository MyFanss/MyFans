import { Test, TestingModule } from '@nestjs/testing';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { JwtUserPayload } from '../auth-module/decorators/current-user.decorator';

const mockUser: JwtUserPayload = { userId: 'user-uuid-1', email: 'test@example.com' };

const mockService = {
  createCode: jest.fn(),
  listCodes: jest.fn(),
  deactivateCode: jest.fn(),
  listRedemptions: jest.fn(),
  validateCode: jest.fn(),
  redeemCode: jest.fn(),
};

describe('ReferralController', () => {
  let controller: ReferralController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReferralController],
      providers: [{ provide: ReferralService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ReferralController);
  });

  describe('createCode', () => {
    it('passes user.userId (not user.id) to service', async () => {
      const expected = { id: 'code-1', code: 'ABCD1234' };
      mockService.createCode.mockResolvedValue(expected);

      const result = await controller.createCode(mockUser, {});

      expect(mockService.createCode).toHaveBeenCalledWith('user-uuid-1', {});
      expect(result).toBe(expected);
    });
  });

  describe('listCodes', () => {
    it('passes user.userId to service', async () => {
      mockService.listCodes.mockResolvedValue([]);

      await controller.listCodes(mockUser);

      expect(mockService.listCodes).toHaveBeenCalledWith('user-uuid-1');
    });
  });

  describe('deactivateCode', () => {
    it('passes user.userId and code id to service', async () => {
      const deactivated = { id: 'code-1', isActive: false };
      mockService.deactivateCode.mockResolvedValue(deactivated);

      const result = await controller.deactivateCode(mockUser, 'code-1');

      expect(mockService.deactivateCode).toHaveBeenCalledWith('user-uuid-1', 'code-1');
      expect(result).toBe(deactivated);
    });
  });

  describe('listRedemptions', () => {
    it('passes user.userId and code id to service', async () => {
      mockService.listRedemptions.mockResolvedValue([]);

      await controller.listRedemptions(mockUser, 'code-1');

      expect(mockService.listRedemptions).toHaveBeenCalledWith('user-uuid-1', 'code-1');
    });
  });

  describe('validateCode', () => {
    it('validates without requiring auth user', async () => {
      mockService.validateCode.mockResolvedValue({ valid: true });

      const result = await controller.validateCode({ code: 'ABCD1234' });

      expect(mockService.validateCode).toHaveBeenCalledWith('ABCD1234');
      expect(result).toEqual({ valid: true });
    });
  });

  describe('redeemCode', () => {
    it('passes user.userId to service', async () => {
      const redemption = { id: 'red-1' };
      mockService.redeemCode.mockResolvedValue(redemption);

      const result = await controller.redeemCode(mockUser, { code: 'ABCD1234' });

      expect(mockService.redeemCode).toHaveBeenCalledWith('user-uuid-1', { code: 'ABCD1234' });
      expect(result).toBe(redemption);
    });
  });
});
