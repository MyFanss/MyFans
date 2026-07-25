import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookAuditService } from './webhook-audit.service';
import { WebhookAuditLog } from './entities/webhook-audit-log.entity';

describe('WebhookAuditService', () => {
  let service: WebhookAuditService;
  let repository: Repository<WebhookAuditLog>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookAuditService,
        {
          provide: getRepositoryToken(WebhookAuditLog),
          useValue: {
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WebhookAuditService>(WebhookAuditService);
    repository = module.get<Repository<WebhookAuditLog>>(
      getRepositoryToken(WebhookAuditLog),
    );
  });

  it('logs webhook secret rotation with custom cutoff', async () => {
    const adminId = 'admin-uuid-123';
    const cutoffMs = 12 * 60 * 60 * 1000;

    await service.logRotation(adminId, cutoffMs);

    expect(repository.save).toHaveBeenCalledWith({
      admin_id: adminId,
      action: 'webhook_secret_rotated',
      details: `Secret rotated with ${cutoffMs}ms grace period`,
    });
  });

  it('logs webhook secret rotation with default cutoff', async () => {
    const adminId = 'admin-uuid-123';

    await service.logRotation(adminId);

    expect(repository.save).toHaveBeenCalledWith({
      admin_id: adminId,
      action: 'webhook_secret_rotated',
      details: 'Secret rotated with default 24h grace period',
    });
  });

  it('logs webhook secret expiration', async () => {
    const adminId = 'admin-uuid-456';

    await service.logExpirePrevious(adminId);

    expect(repository.save).toHaveBeenCalledWith({
      admin_id: adminId,
      action: 'webhook_secret_expired',
      details: 'Previous webhook secret immediately expired',
    });
  });
});
