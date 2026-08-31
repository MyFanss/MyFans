import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * How a referral pays out. Both are off-chain bookkeeping only — the
 * on-chain referral contract is explicitly out of scope (see
 * `docs/REFERRAL_REWARDS.md`).
 *
 * - `OFF_CHAIN_CREDIT`: a fixed platform credit added to the code owner's
 *   balance ledger (`amount` is a token quantity).
 * - `FEE_DISCOUNT`: a percentage discount, in basis points, applied to the
 *   code owner's next platform fee (`amount` is bps, e.g. 1000 = 10%).
 */
export type ReferralRewardKind = 'OFF_CHAIN_CREDIT' | 'FEE_DISCOUNT';

@Entity('referral_rewards')
export class ReferralReward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** FK → referral_redemptions.id (one reward per attributed redemption). */
  @Column({ name: 'redemption_id', type: 'uuid', unique: true })
  redemptionId: string;

  /** The referral code owner who earns this reward. */
  @Column({ name: 'beneficiary_id', type: 'uuid' })
  @Index()
  beneficiaryId: string;

  @Column({ name: 'kind', type: 'varchar', length: 32 })
  kind: ReferralRewardKind;

  /** Token quantity for OFF_CHAIN_CREDIT, or basis points for FEE_DISCOUNT. */
  @Column({ name: 'amount', type: 'numeric', precision: 20, scale: 7 })
  amount: string;

  @Column({ name: 'status', type: 'varchar', length: 16, default: 'GRANTED' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
