import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UploadQuotaService } from './upload-quota.service';

/**
 * Scheduled job that prunes stale content-upload quota rows. Runs hourly —
 * mirrors `IdempotencyCleanupService`.
 */
@Injectable()
export class UploadQuotaCleanupService {
  private readonly logger = new Logger(UploadQuotaCleanupService.name);

  constructor(private readonly uploadQuota: UploadQuotaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron(): Promise<void> {
    const deleted = await this.uploadQuota.purgeExpired();
    if (deleted > 0) {
      this.logger.debug(`Pruned ${deleted} stale upload-quota row(s).`);
    }
  }
}
