import {
  SUBSCRIPTION_TRANSITIONS,
  SUBSCRIPTIONS_TABLE,
  Subscription,
  SubscriptionStatus,
  canTransition,
  hasActiveAccess,
  isSubmissionExpired,
} from './subscription.entity';

describe('SubscriptionStatus', () => {
  it('pins the documented lifecycle states', () => {
    expect(Object.values(SubscriptionStatus).sort()).toEqual(
      [
        'ACTIVE',
        'CANCELLED',
        'CONFIRMED',
        'CREATED',
        'EXPIRED',
        'FAILED',
        'SUBMITTED',
      ].sort(),
    );
  });
});

describe('SUBSCRIPTION_TRANSITIONS', () => {
  it('pins the documented transition table', () => {
    expect(SUBSCRIPTION_TRANSITIONS).toEqual({
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
    });
  });

  it('ACTIVE can leave to CANCELLED or EXPIRED', () => {
    expect(SUBSCRIPTION_TRANSITIONS[SubscriptionStatus.ACTIVE]).toEqual([
      SubscriptionStatus.CANCELLED,
      SubscriptionStatus.EXPIRED,
    ]);
  });

  it('FAILED, CANCELLED and EXPIRED are terminal', () => {
    expect(SUBSCRIPTION_TRANSITIONS[SubscriptionStatus.FAILED]).toEqual([]);
    expect(SUBSCRIPTION_TRANSITIONS[SubscriptionStatus.CANCELLED]).toEqual([]);
    expect(SUBSCRIPTION_TRANSITIONS[SubscriptionStatus.EXPIRED]).toEqual([]);
  });
});

describe('canTransition', () => {
  it('allows every documented forward transition', () => {
    expect(canTransition(SubscriptionStatus.CREATED, SubscriptionStatus.SUBMITTED)).toBe(true);
    expect(canTransition(SubscriptionStatus.CREATED, SubscriptionStatus.FAILED)).toBe(true);
    expect(canTransition(SubscriptionStatus.SUBMITTED, SubscriptionStatus.CONFIRMED)).toBe(true);
    expect(canTransition(SubscriptionStatus.SUBMITTED, SubscriptionStatus.FAILED)).toBe(true);
    expect(canTransition(SubscriptionStatus.CONFIRMED, SubscriptionStatus.ACTIVE)).toBe(true);
  });

  it('allows ACTIVE -> CANCELLED and ACTIVE -> EXPIRED', () => {
    expect(canTransition(SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELLED)).toBe(true);
    expect(canTransition(SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRED)).toBe(true);
  });

  it('is idempotent for every status (same -> same is always allowed)', () => {
    for (const status of Object.values(SubscriptionStatus)) {
      expect(canTransition(status, status)).toBe(true);
    }
  });

  it('rejects skipping straight to ACTIVE from CREATED or SUBMITTED', () => {
    expect(canTransition(SubscriptionStatus.CREATED, SubscriptionStatus.ACTIVE)).toBe(false);
    expect(canTransition(SubscriptionStatus.SUBMITTED, SubscriptionStatus.ACTIVE)).toBe(false);
  });

  it('rejects any transition out of a terminal state', () => {
    expect(canTransition(SubscriptionStatus.FAILED, SubscriptionStatus.CREATED)).toBe(false);
    expect(canTransition(SubscriptionStatus.FAILED, SubscriptionStatus.SUBMITTED)).toBe(false);
    expect(canTransition(SubscriptionStatus.FAILED, SubscriptionStatus.ACTIVE)).toBe(false);
    expect(canTransition(SubscriptionStatus.ACTIVE, SubscriptionStatus.CREATED)).toBe(false);
    expect(canTransition(SubscriptionStatus.ACTIVE, SubscriptionStatus.CONFIRMED)).toBe(false);
    expect(canTransition(SubscriptionStatus.CANCELLED, SubscriptionStatus.ACTIVE)).toBe(false);
    expect(canTransition(SubscriptionStatus.EXPIRED, SubscriptionStatus.ACTIVE)).toBe(false);
  });

  it('rejects backward transitions', () => {
    expect(canTransition(SubscriptionStatus.SUBMITTED, SubscriptionStatus.CREATED)).toBe(false);
    expect(canTransition(SubscriptionStatus.CONFIRMED, SubscriptionStatus.SUBMITTED)).toBe(false);
  });

  it('every legal edge returns true and every other pair returns false', () => {
    for (const from of Object.values(SubscriptionStatus)) {
      for (const to of Object.values(SubscriptionStatus)) {
        const expected = from === to || SUBSCRIPTION_TRANSITIONS[from].includes(to);
        expect(canTransition(from, to)).toBe(expected);
      }
    }
  });
});

describe('hasActiveAccess', () => {
  const now = new Date('2025-01-01T00:00:00Z');
  const past = new Date('2024-12-31T23:59:59Z');
  const future = new Date('2025-01-01T00:00:01Z');

  it('grants access for ACTIVE with a future expiry', () => {
    expect(hasActiveAccess({ status: SubscriptionStatus.ACTIVE, expiresAt: future }, now)).toBe(true);
  });

  it('denies access for ACTIVE with a past expiry', () => {
    expect(hasActiveAccess({ status: SubscriptionStatus.ACTIVE, expiresAt: past }, now)).toBe(false);
  });

  it('denies access for ACTIVE with a null expiry', () => {
    expect(hasActiveAccess({ status: SubscriptionStatus.ACTIVE, expiresAt: null }, now)).toBe(false);
  });

  it('denies access for non-ACTIVE statuses even with a future expiry', () => {
    for (const status of Object.values(SubscriptionStatus)) {
      if (status === SubscriptionStatus.ACTIVE) {
        continue;
      }
      expect(hasActiveAccess({ status, expiresAt: future }, now)).toBe(false);
    }
  });
});

describe('Subscription entity', () => {
  it('can be constructed with the documented fields without throwing', () => {
    expect(() => {
      const sub = new Subscription();
      sub.id = 'sub-1';
      sub.userId = 'user-1';
      sub.planId = 'plan-1';
      sub.status = SubscriptionStatus.CREATED;
      sub.txHash = null;
      sub.verifiedAt = null;
      sub.confirmedAt = null;
      sub.activatedAt = null;
      sub.failedAt = null;
      sub.submitExpiresAt = null;
      sub.expiresAt = null;
      sub.cancelledAt = null;
      sub.referralCode = null;
      sub.referralAttributedAt = null;
      sub.createdAt = new Date();
      sub.updatedAt = new Date();
      return sub;
    }).not.toThrow();
  });

  it('uses the documented table name', () => {
    expect(SUBSCRIPTIONS_TABLE).toBe('subscriptions');
  });

  it('treats a submitExpiresAt in the past as expired relative to now', () => {
    const sub = new Subscription();
    sub.submitExpiresAt = new Date(Date.now() - 1000);

    expect(sub.submitExpiresAt.getTime() < Date.now()).toBe(true);
  });

  it('treats a submitExpiresAt in the future as not yet expired', () => {
    const sub = new Subscription();
    sub.submitExpiresAt = new Date(Date.now() + 60_000);

    expect(sub.submitExpiresAt.getTime() > Date.now()).toBe(true);
  });
});

describe('isSubmissionExpired', () => {
  const now = new Date('2025-01-01T00:00:00Z');
  const past = new Date('2024-12-31T23:59:59Z');
  const future = new Date('2025-01-01T00:00:01Z');

  it('returns false for CREATED even with a past deadline', () => {
    expect(
      isSubmissionExpired({ status: SubscriptionStatus.CREATED, submitExpiresAt: past }, now),
    ).toBe(false);
  });

  it('returns false for SUBMITTED with a null deadline', () => {
    expect(
      isSubmissionExpired({ status: SubscriptionStatus.SUBMITTED, submitExpiresAt: null }, now),
    ).toBe(false);
  });

  it('returns false for SUBMITTED with a future deadline', () => {
    expect(
      isSubmissionExpired({ status: SubscriptionStatus.SUBMITTED, submitExpiresAt: future }, now),
    ).toBe(false);
  });

  it('returns true for SUBMITTED with a past deadline', () => {
    expect(
      isSubmissionExpired({ status: SubscriptionStatus.SUBMITTED, submitExpiresAt: past }, now),
    ).toBe(true);
  });

  it('returns false for CONFIRMED regardless of deadline', () => {
    expect(
      isSubmissionExpired({ status: SubscriptionStatus.CONFIRMED, submitExpiresAt: past }, now),
    ).toBe(false);
  });

  it('returns false for ACTIVE regardless of deadline', () => {
    expect(
      isSubmissionExpired({ status: SubscriptionStatus.ACTIVE, submitExpiresAt: past }, now),
    ).toBe(false);
  });

  it('returns false for FAILED regardless of deadline', () => {
    expect(
      isSubmissionExpired({ status: SubscriptionStatus.FAILED, submitExpiresAt: past }, now),
    ).toBe(false);
  });

  it('is consistent with canTransition: SUBMITTED -> FAILED is allowed', () => {
    const sub = { status: SubscriptionStatus.SUBMITTED, submitExpiresAt: past };
    expect(isSubmissionExpired(sub, now)).toBe(true);
    expect(canTransition(SubscriptionStatus.SUBMITTED, SubscriptionStatus.FAILED)).toBe(true);
  });
});
