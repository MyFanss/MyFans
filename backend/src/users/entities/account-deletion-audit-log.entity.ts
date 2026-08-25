import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/** Audit trail for account deletions — see UsersService#remove (#1566). */
@Entity('account_deletion_audit_logs')
@Index(['user_id'])
export class AccountDeletionAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'text', nullable: true })
  details: string | null;

  @CreateDateColumn()
  created_at: Date;
}
