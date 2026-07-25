import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookAuditLog } from './entities/webhook-audit-log.entity';

@Injectable()
export class WebhookAuditService {
  constructor(
    @InjectRepository(WebhookAuditLog)
    private readonly auditLogRepo: Repository<WebhookAuditLog>,
  ) {}

  async logRotation(adminId: string, cutoffMs?: number): Promise<void> {
    const details = cutoffMs
      ? `Secret rotated with ${cutoffMs}ms grace period`
      : 'Secret rotated with default 24h grace period';

    await this.auditLogRepo.save({
      admin_id: adminId,
      action: 'webhook_secret_rotated',
      details,
    });
  }

  async logExpirePrevious(adminId: string): Promise<void> {
    await this.auditLogRepo.save({
      admin_id: adminId,
      action: 'webhook_secret_expired',
      details: 'Previous webhook secret immediately expired',
    });
  }
}
