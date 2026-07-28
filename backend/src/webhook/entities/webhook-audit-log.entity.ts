import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('webhook_audit_logs')
@Index(['admin_id'])
@Index(['action'])
@Index(['created_at'])
export class WebhookAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  admin_id: string;

  @Column({ type: 'varchar' })
  action: string;

  @Column({ type: 'text', nullable: true })
  details: string | null;

  @CreateDateColumn()
  created_at: Date;
}
