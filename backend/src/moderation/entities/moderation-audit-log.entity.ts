import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ModerationStatus } from './moderation-flag.entity';

@Entity('moderation_audit_logs')
@Index(['flag_id'])
@Index(['admin_id'])
export class ModerationAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  flag_id: string;

  @Column({ type: 'uuid' })
  admin_id: string;

  @Column({ type: 'enum', enum: ModerationStatus, nullable: true })
  previous_status: ModerationStatus | null;

  @Column({ type: 'enum', enum: ModerationStatus })
  new_status: ModerationStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  created_at: Date;
}
