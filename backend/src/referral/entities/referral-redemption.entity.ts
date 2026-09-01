import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * A fan's claim of a referral code.
 *
 * A row is created (pending) when the fan applies a code at checkout. It is
 * only *attributed* — `attributedAt` set, owner reward granted, owning code's
 * `useCount` incremented — when the matching `SubscriptionCreatedEvent` is
 * observed for `subscriberAddress`. Renewals never create or attribute a
 * redemption, so a referral pays out at most once, on the first subscribe.
 */
@Entity('referral_redemptions')
export class ReferralRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** FK → referral_codes.id */
  @Column({ name: 'referral_code_id', type: 'uuid' })
  @Index()
  referralCodeId: string;

  /** The user who claimed the code. */
  @Column({ name: 'redeemer_id', type: 'uuid' })
  @Index()
  redeemerId: string;

  /**
   * Stellar address of the claiming fan, captured at checkout so the
   * attribution consumer can match an incoming `SubscriptionCreatedEvent`
   * (whose `fan` is a G-address) back to this pending claim.
   */
  @Column({
    name: 'subscriber_address',
    type: 'varchar',
    length: 56,
    nullable: true,
  })
  @Index()
  subscriberAddress: string | null;

  /** Null until the first subscribe is attributed to this claim. */
  @Column({ name: 'attributed_at', type: 'timestamp', nullable: true })
  attributedAt: Date | null;

  @CreateDateColumn({ name: 'redeemed_at' })
  redeemedAt: Date;
}
