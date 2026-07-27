import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export enum EmailOutboxStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}

/** Durable record of an email queued for delivery, replacing the previous in-memory-only log. */
@Entity('email_outbox')
@Unique(['dedupe_key'])
@Index(['status'])
export class EmailOutboxEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  dedupe_key: string;

  @Column()
  to_user_id: string;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'enum', enum: EmailOutboxStatus, default: EmailOutboxStatus.PENDING })
  status: EmailOutboxStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  last_error: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sent_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
