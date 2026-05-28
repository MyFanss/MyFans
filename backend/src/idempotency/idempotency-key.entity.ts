import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Stores idempotency keys for mutating requests.
 * A key is scoped to a (key, fingerprint) pair where fingerprint encodes
 * the caller identity (user-id or IP) so keys cannot be replayed across users.
 */
@Entity('idempotency_keys')
@Index(['key', 'fingerprint'], { unique: true })
@Index(['expires_at']) // for efficient cleanup queries
export class IdempotencyKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** The value of the Idempotency-Key header supplied by the client. */
  @Column({ length: 255 })
  key!: string;

  /**
   * Caller fingerprint: userId when authenticated, otherwise IP address.
   * Prevents one user from hijacking another user's idempotency key.
   */
  @Column({ length: 255 })
  fingerprint!: string;

  /** HTTP method of the original request (POST, PUT, PATCH). */
  @Column({ length: 10 })
  method!: string;

  /** Request path (without query string). */
  @Column({ length: 500 })
  path!: string;

  /** Cached HTTP status code of the original response. */
  @Column({ type: 'int', nullable: true })
  response_status!: number | null;

  /** Cached response body (JSON-serialised). Null while the first request is still in-flight. */
  @Column({ type: 'text', nullable: true })
  response_body!: string | null;

  /** Whether the first request has finished processing. */
  @Column({ default: false })
  is_complete!: boolean;

  /** When this record expires and can be purged. */
  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
