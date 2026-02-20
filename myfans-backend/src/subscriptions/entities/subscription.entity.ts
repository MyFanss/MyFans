import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Creator } from '../../creators/entities/creator.entity';
import { User } from '../../users/entities/user.entity';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

/**
 * Subscription entity - links a fan (User) to a creator (Creator).
 * Only one active subscription per (fan_id, creator_id) - enforced by partial unique index.
 *
 * Status transitions:
 * - active → cancelled: user cancels before expiry
 * - active → expired: subscription period ends (expires_at passed)
 * - cancelled and expired are terminal states
 */
@Entity('subscriptions')
@Index(['fan', 'creator'])
@Index(['creator', 'status'])
@Index(['fan', 'creator'], {
  unique: true,
  where: "status = 'active'",
})
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fan_id' })
  fan!: User;

  @ManyToOne(() => Creator, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creator_id' })
  creator!: Creator;

  @Column({
    type: 'varchar',
    length: 20,
    default: SubscriptionStatus.ACTIVE,
  })
  status!: SubscriptionStatus;

  @Column({ name: 'started_at', type: 'datetime' })
  started_at!: Date;

  @Column({ name: 'expires_at', type: 'datetime' })
  expires_at!: Date;

  @Column({ name: 'plan_id', type: 'varchar', nullable: true })
  plan_id!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
