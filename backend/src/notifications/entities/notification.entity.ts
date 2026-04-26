import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum NotificationType {
  NEW_SUBSCRIBER = 'new_subscriber',
  SUBSCRIPTION_RENEWED = 'subscription_renewed',
  SUBSCRIPTION_CANCELLED = 'subscription_cancelled',
  NEW_COMMENT = 'new_comment',
  NEW_LIKE = 'new_like',
  NEW_MESSAGE = 'new_message',
  PAYOUT_SENT = 'payout_sent',
  CONTENT_PUBLISHED = 'content_published',
  SYSTEM = 'system',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'boolean', default: false })
  is_read: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  /** Number of individual events collapsed into this digest (1 = not a digest). */
  @Column({ type: 'int', default: 1 })
  digest_count: number;

  /** ISO timestamps of the individual events batched into this digest. */
  @Column({ type: 'jsonb', nullable: true })
  digest_event_times: string[] | null;

  @CreateDateColumn()
  created_at: Date;
}
