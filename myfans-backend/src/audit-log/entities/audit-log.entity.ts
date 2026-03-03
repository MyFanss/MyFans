import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AuditAction {
  DELETE = 'DELETE',
}

@Entity('audit_logs')
@Index(['entity_type', 'entity_id'])
@Index(['performed_by'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 50 })
  entity_type!: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 36 })
  entity_id!: string;

  @Column({ type: 'varchar', length: 20 })
  action!: AuditAction;

  @Column({ name: 'performed_by', type: 'varchar', length: 36 })
  performed_by!: string;

  @CreateDateColumn({ name: 'performed_at' })
  performed_at!: Date;
}
