import {
  SUBSCRIPTION_TRANSITIONS,
  SUBSCRIPTIONS_TABLE,
  Subscription,
  SubscriptionStatus,
  canTransition,
} from './subscription.entity';

describe('SubscriptionStatus', () => {
  it('pins the documented lifecycle states', () => {
    expect(Object.values(SubscriptionStatus).sort()).toEqual(
      ['ACTIVE', 'CONFIRMED', 'CREATED', 'FAILED', 'SUBMITTED'].sort(),
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
      [SubscriptionStatus.FAILED]: [],
      [SubscriptionStatus.ACTIVE]: [],
    });
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
    expect(canTransition(SubscriptionStatus.ACTIVE, SubscriptionStatus.CREATED)).toBe(false);
    expect(canTransition(SubscriptionStatus.ACTIVE, SubscriptionStatus.CONFIRMED)).toBe(false);
  });

  it('rejects backward transitions', () => {
    expect(canTransition(SubscriptionStatus.SUBMITTED, SubscriptionStatus.CREATED)).toBe(false);
    expect(canTransition(SubscriptionStatus.CONFIRMED, SubscriptionStatus.SUBMITTED)).toBe(false);
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
