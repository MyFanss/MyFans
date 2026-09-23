import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Lifecycle states for a subscription checkout.
 *
 * A subscription MUST NOT be treated as ACTIVE (i.e. grant paid access)
 * until an on-chain `subscribe` event has been observed, or a trusted
 * simulation plus payment proof has been verified. Client-supplied tx
 * hashes are never trusted on their own.
 */
export enum SubscriptionStatus {
  /** Checkout record created; nothing submitted on-chain yet. */
  CREATED = 'CREATED',
  /** A tx hash was supplied by the client and is awaiting RPC verification. */
  SUBMITTED = 'SUBMITTED',
  /** On-chain subscribe observed (or trusted simulation + payment proof). */
  CONFIRMED = 'CONFIRMED',
  /** Terminal failure: verification failed or the submission timed out. */
  FAILED = 'FAILED',
  /** Paid access is granted. Only reachable from CONFIRMED. */
  ACTIVE = 'ACTIVE',
}

/**
 * Allowed transitions for the checkout state machine.
 *
 * CREATED -> SUBMITTED -> CONFIRMED -> ACTIVE
 *                       \-> FAILED
 * CREATED -> FAILED (timeout / abandoned)
 *
 * ACTIVE is intentionally unreachable directly from CREATED or SUBMITTED:
 * this is the invariant that blocks early ACTIVE and unpaid access.
 */
export const SUBSCRIPTION_TRANSITIONS: Readonly<
  Record<SubscriptionStatus, readonly SubscriptionStatus[]>
> = {
  [SubscriptionStatus.CREATED]: [
    SubscriptionStatus.SUBMITTED,
    SubscriptionStatus.FAILED,
  ],
  [SubscriptionStatus.SUBMITTED]: [
    SubscriptionStatus.CONFIRMED,
    SubscriptionStatus.FAILED,
  ],
  [SubscriptionStatus.CONFIRMED]: [SubscriptionStatus.ACTIVE],
  [SubscriptionStatus.FAILED]: [],
  [SubscriptionStatus.ACTIVE]: [],
};

/**
 * Returns true when moving from `from` to `to` is a legal transition.
 * Idempotent re-confirmation (CONFIRMED -> CONFIRMED) is allowed so that
 * duplicate on-chain events or user refreshes do not error.
 */
export function canTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
): boolean {
  if (from === to) {
    return true;
  }
  return SUBSCRIPTION_TRANSITIONS[from]?.includes(to) ?? false;
}

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 128 })
  userId: string;

  @Index()
  @Column({ type: 'varchar', length: 128 })
  planId: string;

  @Index()
  @Column({
    type: 'varchar',
    length: 32,
    default: SubscriptionStatus.CREATED,
  })
  status: SubscriptionStatus;

  /**
   * Client-supplied transaction hash. Untrusted until verified via RPC
   * against the expected invoke args.
   */
  @Index()
  @Column({ type: 'varchar', length: 128, nullable: true })
  txHash: string | null;

  /**
   * Set only after the tx hash has been verified against the expected
   * invoke args via RPC. Never set from client-only claims.
   */
  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  /**
   * Set when the on-chain subscribe event (or trusted simulation plus
   * payment proof) has been observed. This is the gate for ACTIVE.
   */
  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  /**
   * Set when the subscription becomes ACTIVE (paid access granted).
   */
  @Column({ type: 'timestamptz', nullable: true })
  activatedAt: Date | null;

  /**
   * Set when the record transitions to FAILED (verification failure or
   * timeout). Used by the poller to expire stale SUBMITTED records.
   */
  @Column({ type: 'timestamptz', nullable: true })
  failedAt: Date | null;

  /**
   * Deadline for a SUBMITTED record to be confirmed. The poller moves
   * records past this deadline to FAILED.
   */
  @Column({ type: 'timestamptz', nullable: true })
  submitExpiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
