import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('referral_codes')
export class ReferralCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The user who owns / generated this code. */
  @Column({ name: 'owner_id', type: 'uuid' })
  @Index()
  ownerId: string;

  /** The short alphanumeric code (e.g. "ALICE10"). */
  @Column({ unique: true, length: 20 })
  @Index()
  code: string;

  /** Optional max number of uses (null = unlimited). */
  @Column({ name: 'max_uses', type: 'int', nullable: true })
  maxUses: number | null;

  /** How many times the code has been redeemed. */
  @Column({ name: 'use_count', type: 'int', default: 0 })
  useCount: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
