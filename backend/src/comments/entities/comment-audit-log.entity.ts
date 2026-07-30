import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Immutable audit record written whenever a comment is soft-deleted.
 * One row per deletion event; never updated or hard-deleted.
 */
@Entity('comment_audit_logs')
@Index(['commentId'])
@Index(['deletedBy'])
export class CommentAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  commentId: string;

  @Column({ type: 'varchar' })
  deletedBy: string;

  @Column({ type: 'varchar', default: 'soft_delete' })
  action: string;

  @CreateDateColumn()
  createdAt: Date;
}
