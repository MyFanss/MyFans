import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Maps onto the pre-existing `refresh_tokens` table (originally created for
 * the now-removed deprecated `refresh-module`, see SECURITY.md Finding #6).
 * `family_id` and `revoked` were added by
 * `1756000000200-AddRotationToRefreshTokens` to support rotation with reuse
 * detection (#1565): every refresh in a family shares `family_id`; reusing a
 * token already marked `revoked` (i.e. already rotated away) revokes the
 * whole family.
 */
@Entity('refresh_tokens')
@Index(['user_id'])
@Index(['family_id'])
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  /** SHA-256 hex digest of the raw refresh token — the raw value is never stored. */
  @Column({ type: 'varchar', length: 64, unique: true })
  token_hash: string;

  @Column({ type: 'uuid' })
  family_id: string;

  @Column({ type: 'boolean', default: false })
  revoked: boolean;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
