import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { ModerationFlag, ModerationStatus, ContentType, FlagReason } from './entities/moderation-flag.entity';
import { ModerationAuditLog } from './entities/moderation-audit-log.entity';

const mockFlagRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockAuditRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
});

const ADMIN_ID = 'admin-uuid';
const USER_ID = 'user-uuid';
const FLAG_ID = 'flag-uuid';

const baseFlag: ModerationFlag = {
  id: FLAG_ID,
  content_type: ContentType.POST,
  content_id: 'post-uuid',
  reason: FlagReason.SPAM,
  notes: null,
  reported_by: USER_ID,
  status: ModerationStatus.PENDING,
  reviewed_by: null,
  reviewed_at: null,
  admin_notes: null,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('ModerationService', () => {
  let service: ModerationService;
  let flagRepo: ReturnType<typeof mockFlagRepo>;
  let auditRepo: ReturnType<typeof mockAuditRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        { provide: getRepositoryToken(ModerationFlag), useFactory: mockFlagRepo },
        { provide: getRepositoryToken(ModerationAuditLog), useFactory: mockAuditRepo },
      ],
    }).compile();

    service = module.get(ModerationService);
    flagRepo = module.get(getRepositoryToken(ModerationFlag));
    auditRepo = module.get(getRepositoryToken(ModerationAuditLog));
  });

  describe('createFlag', () => {
    const dto = {
      content_type: ContentType.POST,
      content_id: 'post-uuid',
      reason: FlagReason.SPAM,
    };

    it('creates and returns a new flag', async () => {
      flagRepo.findOne.mockResolvedValue(null);
      flagRepo.create.mockReturnValue(baseFlag);
      flagRepo.save.mockResolvedValue(baseFlag);

      const result = await service.createFlag(USER_ID, dto);
      expect(result).toEqual(baseFlag);
      expect(flagRepo.save).toHaveBeenCalledWith(baseFlag);
    });

    it('throws ConflictException when duplicate pending flag exists', async () => {
      flagRepo.findOne.mockResolvedValue(baseFlag);
      await expect(service.createFlag(USER_ID, dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('returns flag when found', async () => {
      flagRepo.findOne.mockResolvedValue(baseFlag);
      const result = await service.findOne(FLAG_ID);
      expect(result).toEqual(baseFlag);
    });

    it('throws NotFoundException when flag missing', async () => {
      flagRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(FLAG_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('reviewFlag', () => {
    it('updates flag status and writes audit log', async () => {
      const updated = { ...baseFlag, status: ModerationStatus.APPROVED, reviewed_by: ADMIN_ID };
      flagRepo.findOne.mockResolvedValue({ ...baseFlag });
      flagRepo.save.mockResolvedValue(updated);
      auditRepo.create.mockReturnValue({ flag_id: FLAG_ID });
      auditRepo.save.mockResolvedValue({});

      const result = await service.reviewFlag(ADMIN_ID, FLAG_ID, {
        status: ModerationStatus.APPROVED,
        admin_notes: 'Looks fine',
      });

      expect(result.status).toBe(ModerationStatus.APPROVED);
      expect(auditRepo.save).toHaveBeenCalledTimes(1);
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          flag_id: FLAG_ID,
          admin_id: ADMIN_ID,
          previous_status: ModerationStatus.PENDING,
          new_status: ModerationStatus.APPROVED,
        }),
      );
    });
  });

  describe('getAuditLog', () => {
    it('returns audit entries for a flag', async () => {
      const entries = [{ id: 'log-1', flag_id: FLAG_ID }];
      flagRepo.findOne.mockResolvedValue(baseFlag);
      auditRepo.find.mockResolvedValue(entries);

      const result = await service.getAuditLog(FLAG_ID);
      expect(result).toEqual(entries);
    });

    it('throws NotFoundException for unknown flag', async () => {
      flagRepo.findOne.mockResolvedValue(null);
      await expect(service.getAuditLog('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
