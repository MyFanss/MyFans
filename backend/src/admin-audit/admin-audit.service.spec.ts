import { Test, TestingModule } from '@nestjs/testing';
import { AdminAuditService } from './admin-audit.service';

describe('AdminAuditService', () => {
  let service: AdminAuditService;
  let repository: { save: jest.Mock; insert: jest.Mock; create: jest.Mock };
  let logger: { log: jest.Mock; error: jest.Mock; warn: jest.Mock };

  beforeEach(async () => {
    repository = {
      save: jest.fn(),
      insert: jest.fn(),
      create: jest.fn((record) => record),
    };
    logger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuditService,
        { provide: 'AdminAuditRepository', useValue: repository },
        { provide: 'Logger', useValue: logger },
      ],
    })
      .overrideProvider(AdminAuditService)
      .useValue(new AdminAuditService(repository as any, logger as any))
      .compile();

    service = module.get<AdminAuditService>(AdminAuditService);
  });

  it('persists the expected audit record fields on success', async () => {
    const record = {
      actor: 'admin-1',
      action: 'user.suspend',
      target: 'user-42',
    };
    const persisted = { ...record, id: 'audit-1', timestamp: new Date() };
    repository.save.mockResolvedValue(persisted);

    const result = await (service as any).record(record);

    expect(repository.save).toHaveBeenCalledTimes(1);
    const savedArg = repository.save.mock.calls[0][0];
    expect(savedArg).toMatchObject({
      actor: 'admin-1',
      action: 'user.suspend',
      target: 'user-42',
    });
    expect(savedArg.timestamp).toBeInstanceOf(Date);
    expect(result).toEqual(persisted);
  });

  it('surfaces persistence failures instead of silently dropping them', async () => {
    const error = new Error('db write failed');
    repository.save.mockRejectedValue(error);

    await expect(
      (service as any).record({
        actor: 'admin-1',
        action: 'user.suspend',
        target: 'user-42',
      }),
    ).rejects.toThrow('db write failed');

    expect(repository.save).toHaveBeenCalledTimes(1);
  });
});
