import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('referral_redemptions')
export class ReferralRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** FK → referral_codes.id */
  @Column({ name: 'referral_code_id', type: 'uuid' })
  @Index()
  referralCodeId: string;

  /** The user who redeemed the code. */
  @Column({ name: 'redeemer_id', type: 'uuid' })
  @Index()
  redeemerId: string;

  @CreateDateColumn({ name: 'redeemed_at' })
  redeemedAt: Date;
}
