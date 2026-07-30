import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailOutboxEntry, EmailOutboxStatus } from './entities/email-outbox-entry.entity';
import { EMAIL_ADAPTER, EmailAdapter } from './adapters/email-adapter.interface';

export interface EnqueueEmailRequest {
  dedupeKey: string;
  toUserId: string;
  subject: string;
  body: string;
}

/**
 * Durable email queue: every email is persisted to the `email_outbox` table
 * before delivery is attempted, and stays there (pending/failed) until
 * delivered — replacing the previous in-memory-only `sentEmails` log.
 *
 * Retries: delivery failures increment `attempts` and leave the row
 * `pending` for {@link processPending} to pick back up (intended to be
 * called on a timer — see `NotificationRetryWorkerService`) until
 * `maxAttempts` is reached, at which point the row is marked `failed` and
 * left for manual/alerting follow-up rather than retried forever.
 */
@Injectable()
export class EmailOutboxService {
  private readonly logger = new Logger(EmailOutboxService.name);
  private readonly maxAttempts = 5;

  constructor(
    @InjectRepository(EmailOutboxEntry)
    private readonly repo: Repository<EmailOutboxEntry>,
    @Inject(EMAIL_ADAPTER)
    private readonly adapter: EmailAdapter,
  ) {}

  async enqueue(request: EnqueueEmailRequest): Promise<EmailOutboxEntry> {
    const existing = await this.repo.findOne({ where: { dedupe_key: request.dedupeKey } });
    if (existing) {
      return existing;
    }

    const entry = this.repo.create({
      dedupe_key: request.dedupeKey,
      to_user_id: request.toUserId,
      subject: request.subject,
      body: request.body,
      status: EmailOutboxStatus.PENDING,
      attempts: 0,
      last_error: null,
      sent_at: null,
    });
    const saved = await this.repo.save(entry);
    await this.deliver(saved);
    return saved;
  }

  /** Re-attempts delivery of every still-pending row. Intended for a scheduled worker tick. */
  async processPending(): Promise<void> {
    const pending = await this.repo.find({ where: { status: EmailOutboxStatus.PENDING } });
    for (const entry of pending) {
      await this.deliver(entry);
    }
  }

  async listAll(): Promise<EmailOutboxEntry[]> {
    return this.repo.find({ order: { created_at: 'ASC' } });
  }

  private async deliver(entry: EmailOutboxEntry): Promise<void> {
    try {
      await this.adapter.send({ to: entry.to_user_id, subject: entry.subject, body: entry.body });
      entry.status = EmailOutboxStatus.SENT;
      entry.sent_at = new Date();
      entry.last_error = null;
      await this.repo.save(entry);
    } catch (error) {
      entry.attempts += 1;
      entry.last_error = error instanceof Error ? error.message : String(error);
      entry.status =
        entry.attempts >= this.maxAttempts ? EmailOutboxStatus.FAILED : EmailOutboxStatus.PENDING;
      await this.repo.save(entry);
      this.logger.warn(
        `Email delivery failed for ${entry.dedupe_key} (attempt ${entry.attempts}): ${entry.last_error}`,
      );
    }
  }
}
