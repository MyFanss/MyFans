import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Maps an off-chain `Creator` (CreatorProfile) row to the numeric creator_id
 * registered on-chain in the `creator-registry` Soroban contract
 * (see `contract/contracts/creator-registry`).
 *
 * `onchain_creator_id` is stored as text since Postgres `bigint` values are
 * returned as strings by `pg`/TypeORM and a Soroban `u64` can exceed
 * `Number.MAX_SAFE_INTEGER`.
 */
@Entity('creator_onchain_mappings')
@Index(['creator_id'], { unique: true })
export class CreatorOnchainMapping {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** FK to `creators.id` (the off-chain CreatorProfile). */
  @Column({ name: 'creator_id', unique: true })
  creator_id!: string;

  /** Stellar G-address the creator registered on-chain with. */
  @Column({ name: 'stellar_address', length: 56 })
  stellar_address!: string;

  /** `creator_id` as returned by the creator-registry contract's `get_creator_id`. */
  @Column({ name: 'onchain_creator_id', type: 'varchar' })
  onchain_creator_id!: string;

  /** Last time this mapping was written or confirmed to match the chain. */
  @Column({ name: 'last_synced_at', type: 'timestamptz' })
  last_synced_at!: Date;

  /** Set by `reconcile()` when the stored value no longer matches the chain; cleared on next successful sync. */
  @Column({ name: 'drift_detected_at', type: 'timestamptz', nullable: true })
  drift_detected_at!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
