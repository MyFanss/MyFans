import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ReferralService } from './referral.service';
import { ReferralCode } from './entities/referral-code.entity';
import { ReferralRedemption } from './entities/referral-redemption.entity';

const mockCodesRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockRedemptionsRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockDataSource = () => ({
  transaction: jest.fn(),
});

describe('ReferralService', () => {
  let service: ReferralService;
  let codesRepo: ReturnType<typeof mockCodesRepo>;
  let redemptionsRepo: ReturnType<typeof mockRedemptionsRepo>;
  let dataSource: ReturnType<typeof mockDataSource>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralService,
        { provide: getRepositoryToken(ReferralCode), useFactory: mockCodesRepo },
        { provide: getRepositoryToken(ReferralRedemption), useFactory: mockRedemptionsRepo },
        { provide: DataSource, useFactory: mockDataSource },
      ],
    }).compile();

    service = module.get(ReferralService);
    codesRepo = module.get(getRepositoryToken(ReferralCode));
    redemptionsRepo = module.get(getRepositoryToken(ReferralRedemption));
    dataSource = module.get(DataSource);
  });

  describe('createCode', () => {
    it('creates a unique code for the owner', async () => {
      codesRepo.findOne.mockResolvedValue(null); // no collision
      const saved = { id: 'uuid-1', code: 'ABCD1234', ownerId: 'user-1', maxUses: null, useCount: 0, isActive: true };
      codesRepo.create.mockReturnValue(saved);
      codesRepo.save.mockResolvedValue(saved);

      const result = await service.createCode('user-1', {});
      expect(result.ownerId).toBe('user-1');
      expect(codesRepo.save).toHaveBeenCalled();
    });

    it('respects maxUses when provided', async () => {
      codesRepo.findOne.mockResolvedValue(null);
      const saved = { id: 'uuid-2', code: 'XYZ99999', ownerId: 'user-1', maxUses: 50, useCount: 0, isActive: true };
      codesRepo.create.mockReturnValue(saved);
      codesRepo.save.mockResolvedValue(saved);

      const result = await service.createCode('user-1', { maxUses: 50 });
      expect(result.maxUses).toBe(50);
    });
  });

  describe('validateCode', () => {
    it('returns valid:true for an active code with capacity', async () => {
      codesRepo.findOne.mockResolvedValue({ code: 'GOOD1234', isActive: true, maxUses: 10, useCount: 5 });
      const result = await service.validateCode('GOOD1234');
      expect(result).toEqual({ valid: true });
    });

    it('returns valid:false when code not found', async () => {
      codesRepo.findOne.mockResolvedValue(null);
      const result = await service.validateCode('MISSING1');
      expect(result.valid).toBe(false);
    });

    it('returns valid:false when code is inactive', async () => {
      codesRepo.findOne.mockResolvedValue({ isActive: false, maxUses: null, useCount: 0 });
      const result = await service.validateCode('DEAD1234');
      expect(result.valid).toBe(false);
    });

    it('returns valid:false when usage limit reached', async () => {
      codesRepo.findOne.mockResolvedValue({ isActive: true, maxUses: 5, useCount: 5 });
      const result = await service.validateCode('FULL1234');
      expect(result.valid).toBe(false);
    });
  });

  describe('redeemCode', () => {
    const buildManager = (overrides: Record<string, jest.Mock> = {}) => ({
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      ...overrides,
    });

    it('redeems a valid code and increments useCount', async () => {
      const code = { id: 'code-uuid', code: 'VALID123', ownerId: 'owner-1', isActive: true, maxUses: null, useCount: 0 };
      const redemption = { id: 'red-uuid', referralCodeId: 'code-uuid', redeemerId: 'user-2' };
      const manager = buildManager({
        findOne: jest.fn()
          .mockResolvedValueOnce(code)       // ReferralCode lookup
          .mockResolvedValueOnce(null),       // no prior redemption
        create: jest.fn().mockReturnValue(redemption),
        save: jest.fn().mockResolvedValue(redemption),
      });
      dataSource.transaction.mockImplementation((cb: (m: typeof manager) => Promise<unknown>) => cb(manager));

      const result = await service.redeemCode('user-2', { code: 'VALID123' });
      expect(result).toEqual(redemption);
      expect(manager.save).toHaveBeenCalledWith(ReferralCode, expect.objectContaining({ useCount: 1 }));
    });

    it('throws NotFoundException when code does not exist', async () => {
      const manager = buildManager({ findOne: jest.fn().mockResolvedValue(null) });
      dataSource.transaction.mockImplementation((cb: (m: typeof manager) => Promise<unknown>) => cb(manager));

      await expect(service.redeemCode('user-2', { code: 'NOPE1234' })).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when owner tries to redeem own code', async () => {
      const code = { id: 'code-uuid', code: 'OWN12345', ownerId: 'user-1', isActive: true, maxUses: null, useCount: 0 };
      const manager = buildManager({ findOne: jest.fn().mockResolvedValue(code) });
      dataSource.transaction.mockImplementation((cb: (m: typeof manager) => Promise<unknown>) => cb(manager));

      await expect(service.redeemCode('user-1', { code: 'OWN12345' })).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException on duplicate redemption', async () => {
      const code = { id: 'code-uuid', code: 'DUP12345', ownerId: 'owner-1', isActive: true, maxUses: null, useCount: 1 };
      const existing = { id: 'red-uuid' };
      const manager = buildManager({
        findOne: jest.fn()
          .mockResolvedValueOnce(code)
          .mockResolvedValueOnce(existing),
      });
      dataSource.transaction.mockImplementation((cb: (m: typeof manager) => Promise<unknown>) => cb(manager));

      await expect(service.redeemCode('user-2', { code: 'DUP12345' })).rejects.toThrow(ConflictException);
    });
  });

  describe('deactivateCode', () => {
    it('deactivates a code owned by the user', async () => {
      const code = { id: 'code-uuid', ownerId: 'user-1', isActive: true };
      codesRepo.findOne.mockResolvedValue(code);
      codesRepo.save.mockResolvedValue({ ...code, isActive: false });

      const result = await service.deactivateCode('user-1', 'code-uuid');
      expect(result.isActive).toBe(false);
    });

    it('throws ForbiddenException when user does not own the code', async () => {
      codesRepo.findOne.mockResolvedValue({ id: 'code-uuid', ownerId: 'other-user' });
      await expect(service.deactivateCode('user-1', 'code-uuid')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when code does not exist', async () => {
      codesRepo.findOne.mockResolvedValue(null);
      await expect(service.deactivateCode('user-1', 'code-uuid')).rejects.toThrow(NotFoundException);
    });
  });
});
