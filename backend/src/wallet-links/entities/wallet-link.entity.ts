import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Links a platform user (JWT identity, `users.id`) to a Stellar wallet
 * address (Stellar-bearer identity). This is the bridge table referenced by
 * `AUTH_MODES.md`'s "Future work: true unification" section.
 *
 * There is intentionally no on-chain proof-of-ownership flow wired up yet
 * (that's future work); this table is the storage side of the bridge so
 * `ContentAccessService` and account deletion can resolve/clean up a user's
 * linked address(es).
 */
@Entity('wallet_links')
@Index(['user_id'])
export class WalletLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 56, unique: true })
  stellar_address: string;

  /** True for the address used when resolving a JWT identity to a Stellar address. */
  @Column({ type: 'boolean', default: true })
  is_primary: boolean;

  @CreateDateColumn()
  created_at: Date;
}
