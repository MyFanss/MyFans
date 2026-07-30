import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import type { SubscriptionLifecycleNotificationRequest } from '../notifications.service';

/**
 * Matches `NotificationQueueJob['status']` in `notifications.service.ts` —
 * kept as a plain string union (rather than a TS enum) so job records can
 * flow between the in-memory queue and this entity without a nominal-type
 * mismatch.
 */
export type RetryJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export const RETRY_JOB_STATUSES: RetryJobStatus[] = [
  'pending',
  'processing',
  'completed',
  'failed',
];

/**
 * Durable mirror of the subscription-lifecycle notification retry queue, so
 * pending/failed jobs survive a process restart instead of living only in
 * `NotificationsService`'s in-memory Map.
 */
@Entity('notification_retry_jobs')
@Index(['status'])
export class NotificationRetryJobEntity {
  @PrimaryColumn()
  dedupe_key: string;

  @Column({ type: 'jsonb' })
  payload: SubscriptionLifecycleNotificationRequest;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'enum', enum: RETRY_JOB_STATUSES, default: 'pending' })
  status: RetryJobStatus;

  @Column({ type: 'text', nullable: true })
  last_error: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
