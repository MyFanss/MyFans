import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContextService } from '../common/services/request-context.service';
import { AuditableAction } from './auditable-action';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

describe('AuditService', () => {
  let service: AuditService;
  let repo: jest.Mocked<Pick<Repository<AuditLog>, 'create' | 'save' | 'findAndCount'>>;

  beforeEach(async () => {
    repo = {
      create: jest.fn((x) => x as AuditLog),
      save: jest.fn().mockResolvedValue({}),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    } as unknown as jest.Mocked<Pick<Repository<AuditLog>, 'create' | 'save' | 'findAndCount'>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: repo,
        },
        {
          provide: RequestContextService,
          useValue: { getCorrelationId: jest.fn().mockReturnValue('corr-1') },
        },
      ],
    }).compile();

    service = module.get(AuditService);
  });

  it('persists sanitized metadata', async () => {
    await service.record({
      action: AuditableAction.AUTH_SESSION_CREATED,
      actorType: 'user',
      actorId: 'GADDR',
      metadata: { password: 'secret', ok: true },
    });
    const saved = repo.save.mock.calls[0][0] as AuditLog;
    expect(saved.metadata?.password).toBe('[REDACTED]');
    expect(saved.metadata?.ok).toBe(true);
  });

  it('does not throw when persistence fails', async () => {
    repo.save.mockRejectedValueOnce(new Error('db down'));
    await expect(
      service.record({
        action: AuditableAction.AUTH_SESSION_CREATED,
        actorType: 'user',
        actorId: 'GADDR',
      }),
    ).resolves.toBeUndefined();
  });

  it('query returns paginated rows', async () => {
    const row = { id: '1' } as AuditLog;
    repo.findAndCount.mockResolvedValue([[row], 1]);
    const result = await service.query({ page: 1, limit: 10 });
    expect(result.data).toEqual([row]);
    expect(result.total).toBe(1);
  });
});
