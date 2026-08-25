import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Append-only audit trail for admin-privileged actions (#1568): role
 * changes and moderation decisions. Rows are never updated or deleted —
 * there is deliberately no repository method or endpoint that mutates an
 * existing row, so a compromised admin token can act, but cannot erase the
 * record of having acted.
 *
 * `payload_hash` stores a SHA-256 digest of the action's contextual
 * payload (e.g. previous/new role, flag status transition) rather than the
 * raw payload itself, so the log stays lightweight and tamper-evident
 * without duplicating potentially sensitive record contents.
 */
@Entity('admin_audit_events')
@Index(['actor_id'])
@Index(['target'])
@Index(['action'])
@Index(['correlation_id'])
export class AdminAuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** User ID of the admin/actor who performed the action. */
  @Column({ type: 'varchar' })
  actor_id: string;

  /** Machine-readable action name, e.g. "user.role_changed", "moderation.flag_reviewed". */
  @Column({ type: 'varchar' })
  action: string;

  /** ID of the entity the action was performed on (user id, flag id, etc). */
  @Column({ type: 'varchar' })
  target: string;

  /** SHA-256 hex digest of the action's contextual payload. */
  @Column({ type: 'varchar' })
  payload_hash: string;

  /** Correlation ID of the HTTP request that triggered this action, if any. */
  @Column({ type: 'varchar', nullable: true })
  correlation_id: string | null;

  @CreateDateColumn()
  created_at: Date;
}
