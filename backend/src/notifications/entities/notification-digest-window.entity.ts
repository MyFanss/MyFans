import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Durable mirror of an open digest window (`userId:type:creatorUserId` ->
 * batched notification), so a restart doesn't silently drop an in-flight
 * digest and start a fresh one on the next event.
 */
@Entity('notification_digest_windows')
export class NotificationDigestWindowEntity {
  /** `${userId}:${type}:${creatorUserId}` */
  @PrimaryColumn()
  digest_key: string;

  @Column()
  notification_id: string;

  @Column({ type: 'jsonb' })
  event_times: string[];

  /** Epoch ms after which this window is considered expired. */
  @Column({ type: 'bigint' })
  window_expires_at: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
