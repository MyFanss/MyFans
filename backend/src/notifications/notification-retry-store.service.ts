import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotificationRetryJobEntity,
  RetryJobStatus,
} from './entities/notification-retry-job.entity';
import type { SubscriptionLifecycleNotificationRequest } from './notifications.service';

export interface RetryJobRecord {
  dedupeKey: string;
  payload: SubscriptionLifecycleNotificationRequest;
  attempts: number;
  status: RetryJobStatus;
  lastError?: string;
}

/** Durable backing store for the subscription-lifecycle retry queue. */
@Injectable()
export class NotificationRetryStoreService {
  constructor(
    @InjectRepository(NotificationRetryJobEntity)
    private readonly repo: Repository<NotificationRetryJobEntity>,
  ) {}

  async upsert(job: RetryJobRecord): Promise<void> {
    const entity = this.repo.create({
      dedupe_key: job.dedupeKey,
      payload: job.payload,
      attempts: job.attempts,
      status: job.status,
      last_error: job.lastError ?? null,
    });
    await this.repo.save(entity);
  }

  async listAll(): Promise<RetryJobRecord[]> {
    const rows = await this.repo.find();
    return rows.map((row) => this.toRecord(row));
  }

  async listPending(): Promise<RetryJobRecord[]> {
    const rows = await this.repo.find({ where: { status: 'pending' } });
    return rows.map((row) => this.toRecord(row));
  }

  private toRecord(row: NotificationRetryJobEntity): RetryJobRecord {
    return {
      dedupeKey: row.dedupe_key,
      payload: row.payload,
      attempts: row.attempts,
      status: row.status,
      lastError: row.last_error ?? undefined,
    };
  }
}
