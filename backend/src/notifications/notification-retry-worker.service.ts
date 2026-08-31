import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { EmailOutboxService } from './email-outbox.service';

/**
 * Background worker: runs on a cron schedule (default: every minute) to
 * drain the pending subscription-lifecycle retry queue and re-attempt any
 * pending outbox emails. Both underlying operations are already idempotent
 * (dedupe-keyed retry jobs, dedupe-keyed outbox rows), so overlapping ticks
 * are safe.
 *
 * Override schedule with `EMAIL_OUTBOX_CRON` env var (cron expression).
 */
@Injectable()
export class NotificationRetryWorkerService {
  private readonly logger = new Logger(NotificationRetryWorkerService.name);
  private ticking = false;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly emailOutbox: EmailOutboxService,
  ) {}

  @Cron(process.env.EMAIL_OUTBOX_CRON ?? '* * * * *')
  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.notificationsService.processRetryQueue();
      await this.emailOutbox.processPending();
    } catch (error) {
      this.logger.error(
        `Retry worker tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.ticking = false;
    }
  }
}
