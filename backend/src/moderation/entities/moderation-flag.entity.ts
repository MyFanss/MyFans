import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';

export enum ModerationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  UNDER_REVIEW = 'under_review',
}

export enum ContentType {
  POST = 'post',
  COMMENT = 'comment',
  USER = 'user',
}

export enum FlagReason {
  SPAM = 'spam',
  HARASSMENT = 'harassment',
  EXPLICIT_CONTENT = 'explicit_content',
  MISINFORMATION = 'misinformation',
  COPYRIGHT = 'copyright',
  OTHER = 'other',
}

@Entity('moderation_flags')
@Index(['content_type', 'content_id'])
@Index(['status'])
export class ModerationFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ContentType })
  content_type: ContentType;

  @Column({ type: 'uuid' })
  content_id: string;

  @Column({ type: 'enum', enum: FlagReason })
  reason: FlagReason;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** User who submitted the flag */
  @Column({ type: 'uuid' })
  reported_by: string;

  @Column({
    type: 'enum',
    enum: ModerationStatus,
    default: ModerationStatus.PENDING,
  })
  status: ModerationStatus;

  /** Admin who last acted on this flag */
  @Column({ type: 'uuid', nullable: true })
  reviewed_by: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  admin_notes: string | null;

  /**
   * Timestamp when the flag entered its current status.
   * Used to compute queue-age SLA metrics (how long a flag has been waiting).
   * Defaults to created_at on insert; updated whenever status changes.
   */
  @Column({ type: 'timestamp', nullable: true })
  @Index()
  queued_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @BeforeInsert()
  setQueuedAt() {
    if (!this.queued_at) {
      this.queued_at = new Date();
    }
  }
}
