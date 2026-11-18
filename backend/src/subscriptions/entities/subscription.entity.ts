import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const SUBSCRIPTIONS_TABLE = 'subscriptions';

export enum SubscriptionStatus {
  CREATED = 'CREATED',
  SUBMITTED = 'SUBMITTED',
  CONFIRMED = 'CONFIRMED',
  ACTIVE = 'ACTIVE',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export const SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  [SubscriptionStatus.CREATED]: [
    SubscriptionStatus.SUBMITTED,
    SubscriptionStatus.FAILED,
  ],
  [SubscriptionStatus.SUBMITTED]: [
    SubscriptionStatus.CONFIRMED,
    SubscriptionStatus.FAILED,
  ],
  [SubscriptionStatus.CONFIRMED]: [SubscriptionStatus.ACTIVE],
  [SubscriptionStatus.ACTIVE]: [
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.EXPIRED,
  ],
  [SubscriptionStatus.FAILED]: [],
  [SubscriptionStatus.CANCELLED]: [],
  [SubscriptionStatus.EXPIRED]: [],
};

export function canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  if (from === to) {
    return true;
  }
  return SUBSCRIPTION_TRANSITIONS[from].includes(to);
}

export function isSubmissionExpired(
  sub: { status: SubscriptionStatus; submitExpiresAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (sub.status !== SubscriptionStatus.SUBMITTED) {
    return false;
  }
  if (!sub.submitExpiresAt) {
    return false;
  }
  return sub.submitExpiresAt.getTime() < now.getTime();
}

/**
 * A subscription grants paid access only while it is ACTIVE and its contract
 * expiry (expiresAt) is still in the future. Expired rows are not access.
 */
export function hasActiveAccess(
  sub: { status: SubscriptionStatus; expiresAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (sub.status !== SubscriptionStatus.ACTIVE) {
    return false;
  }
  if (!sub.expiresAt) {
    return false;
  }
  return sub.expiresAt.getTime() > now.getTime();
}

@Entity(SUBSCRIPTIONS_TABLE)
@Index(['userId'])
@Index(['status'])
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  planId: string;

  @Column({ type: 'varchar', default: SubscriptionStatus.CREATED })
  status: SubscriptionStatus;

  @Column({ type: 'varchar', nullable: true })
  txHash: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  activatedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  failedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  submitExpiresAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  referralCode: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  referralAttributedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
