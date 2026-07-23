import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('webhook_processed_events')
@Unique(['event_id'])
@Index(['event_type'])
@Index(['processed_at'])
export class WebhookProcessedEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  event_id: string;

  @Column({ type: 'varchar' })
  event_type: string;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @CreateDateColumn()
  processed_at: Date;
}
