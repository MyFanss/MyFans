import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Immutable audit record written whenever a post is soft-deleted.
 * One row per deletion event; never updated or hard-deleted.
 */
@Entity('post_audit_logs')
@Index(['postId'])
@Index(['deletedBy'])
export class PostAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  postId: string;

  @Column({ type: 'varchar' })
  deletedBy: string;

  @Column({ type: 'varchar', default: 'soft_delete' })
  action: string;

  @CreateDateColumn()
  createdAt: Date;
}
