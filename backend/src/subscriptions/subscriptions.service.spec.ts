import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '../events/event-bus';
import { InProcessEventBus } from '../events/in-process-event-bus';
import { SubscriptionChainReaderService } from './subscription-chain-reader.service';
import { SubscriptionsService } from './subscriptions.service';
import {
  SUBSCRIPTION_EVENT_PUBLISHER,
  SUBSCRIPTION_RENEWAL_FAILED,
  SubscriptionEventPublisher,
} from './events';
import { SubscriptionIndexRepository } from './repositories/subscription-index.repository';
import {
  SubscriptionIndexEntity,
  SubscriptionStatus,
} from './entities/subscription-index.entity';

function makeChainReader(): SubscriptionChainReaderService {
  return {
    getConfiguredContractId: jest.fn().mockReturnValue(undefined),
    readIsSubscriber: jest.fn(),
  } as unknown as SubscriptionChainReaderService;
}

function makeSub(
  overrides: Partial<SubscriptionIndexEntity> = {},
): SubscriptionIndexEntity {
  return {
    id: 'sub-1',
    fan: 'GFAN1111111111111111111111111111111111111111111111111111',
    creator: 'GAAAAAAAAAAAAAAA',
    planId: 1,
    expiryUnix: Math.floor(Date.now() / 1000) + 3600,
    createdAt: new Date(),
    updatedAt: new Date(),
    indexedAt: new Date(),
    status: SubscriptionStatus.ACTIVE,
    ledgerSeq: -1,
    eventIndex: -1,
    eventType: 'manual',
    ...overrides,
  };
}

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let eventPublisher: jest.Mocked<SubscriptionEventPublisher>;
  let eventBus: InProcessEventBus;
  let repo: jest.Mocked<SubscriptionIndexRepository>;
  let currentSubs: SubscriptionIndexEntity[];

  beforeEach(async () => {
    currentSubs = [];
    eventPublisher = { emit: jest.fn() };
    eventBus = new InProcessEventBus();
    repo = {
      upsertManual: jest.fn(async (data) => {
        const existingIndex = currentSubs.findIndex(
          (sub) => sub.fan === data.fan && sub.creator === data.creator,
        );
        const next = makeSub({
          id: existingIndex >= 0 ? currentSubs[existingIndex].id : `sub-${currentSubs.length + 1}`,
          fan: data.fan,
          creator: data.creator,
          planId: data.planId,
          expiryUnix: data.expiryUnix,
          status: data.status,
        });
        if (existingIndex >= 0) {
          currentSubs[existingIndex] = next;
        } else {
          currentSubs.push(next);
        }
        return next;
      }),
      findCurrentForFanCreator: jest.fn(async (fan, creator) =>
        currentSubs.find((sub) => sub.fan === fan && sub.creator === creator) ?? null,
      ),
      isSubscriber: jest.fn(async (fan, creator) => {
        const sub = currentSubs.find(
          (entry) => entry.fan === fan && entry.creator === creator,
        );
        return !!sub && sub.status === SubscriptionStatus.ACTIVE;
      }),
      findAndCountForFan: jest.fn(async (fan, status, _sort, page, limit) => {
        const filtered = currentSubs.filter(
          (sub) => sub.fan === fan && (status ? sub.status === status : true),
        );
        const start = (page - 1) * limit;
        return [filtered.slice(start, start + limit), filtered.length];
      }),
      listForCreator: jest.fn(async (creator) =>
        currentSubs.filter((sub) => sub.creator === creator),
      ),
      listActiveForFan: jest.fn(async (fan) =>
        currentSubs.filter(
          (sub) => sub.fan === fan && sub.status === SubscriptionStatus.ACTIVE,
        ),
      ),
      updateStatus: jest.fn(async (fan, creator, status, expiryUnix) => {
        const sub = currentSubs.find(
          (entry) => entry.fan === fan && entry.creator === creator,
        );
        if (sub) {
          sub.status = status;
          sub.expiryUnix = expiryUnix ?? sub.expiryUnix;
        }
      }),
      findAllForReconciler: jest.fn(async () => currentSubs),
      findWithCursor: jest.fn(async (fan, status, sort, cursorId, limit) => {
        let filtered = currentSubs.filter(
          (sub) => sub.fan === fan && (status ? sub.status === status : true),
        );
        if (cursorId) {
          filtered = filtered.filter((sub) => sub.id > cursorId);
        }
        return filtered.slice(0, limit + 1);
      }),
    } as unknown as jest.Mocked<SubscriptionIndexRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: EventBus, useValue: eventBus },
        { provide: SubscriptionChainReaderService, useValue: makeChainReader() },
        { provide: SUBSCRIPTION_EVENT_PUBLISHER, useValue: eventPublisher },
        { provide: SubscriptionIndexRepository, useValue: repo },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  it('emits renewal_failed event when checkout failure is recorded', async () => {
    const checkout = service.createCheckout(
      'GFANADDRESS111111111111111111111111111111111111111111111111',
      'GAAAAAAAAAAAAAAA',
      1,
    );

    service.failCheckout(checkout.id, 'insufficient funds');
    await Promise.resolve();

    expect(eventPublisher.emit).toHaveBeenCalledWith(
      SUBSCRIPTION_RENEWAL_FAILED,
      expect.objectContaining({
        subscriptionId: checkout.id,
        reason: 'insufficient funds',
        userId: checkout.fanAddress,
      }),
    );
  });

  it('lists subscriptions from the repository', async () => {
    await service.addSubscription(
      'GFANADDRESS333333333333333333333333333333333333333333333333',
      'GAAAAAAAAAAAAAAA',
      1,
      Math.floor(Date.now() / 1000) + 60,
    );

    const result = await service.listSubscriptions(
      'GFANADDRESS333333333333333333333333333333333333333333333333',
    );

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(repo.findWithCursor).toHaveBeenCalledWith(
      'GFANADDRESS333333333333333333333333333333333333333333333333',
      undefined,
      undefined,
      undefined,
      20,
    );
  });

  it('passes status and cursor to findWithCursor', async () => {
    await service.addSubscription(
      'GFANADDRESS666666666666666666666666666666666666666666666666',
      'GAAAAAAAAAAAAAAA',
      1,
      Math.floor(Date.now() / 1000) + 60,
    );

    await service.listSubscriptions(
      'GFANADDRESS666666666666666666666666666666666666666666666666',
      SubscriptionStatus.ACTIVE,
      'created',
      'some-cursor',
      10,
    );

    expect(repo.findWithCursor).toHaveBeenCalledWith(
      'GFANADDRESS666666666666666666666666666666666666666666666666',
      SubscriptionStatus.ACTIVE,
      'created',
      'some-cursor',
      10,
    );
  });

  it('filters by status=active via findWithCursor', async () => {
    const fan = 'GFANADDRESS777777777777777777777777777777777777777777777777';
    await service.addSubscription(fan, 'GAAAAAAAAAAAAAAA', 1, Math.floor(Date.now() / 1000) + 3600);

    await service.listSubscriptions(fan, SubscriptionStatus.ACTIVE, undefined, undefined, 20);

    expect(repo.findWithCursor).toHaveBeenCalledWith(fan, SubscriptionStatus.ACTIVE, undefined, undefined, 20);
  });

  it('filters by status=expired via findWithCursor', async () => {
    const fan = 'GFANADDRESS888888888888888888888888888888888888888888888888';
    await service.addSubscription(fan, 'GAAAAAAAAAAAAAAA', 1, Math.floor(Date.now() / 1000) - 3600);

    await service.listSubscriptions(fan, SubscriptionStatus.EXPIRED, undefined, undefined, 20);

    expect(repo.findWithCursor).toHaveBeenCalledWith(fan, SubscriptionStatus.EXPIRED, undefined, undefined, 20);
  });

  it('passes sort=expiry to findWithCursor', async () => {
    const fan = 'GFANADDRESS999999999999999999999999999999999999999999999999';
    await service.listSubscriptions(fan, undefined, 'expiry', undefined, 20);

    expect(repo.findWithCursor).toHaveBeenCalledWith(fan, undefined, 'expiry', undefined, 20);
  });

  it('listCreatorSubscribers sorts by expiry when sort=expiry', async () => {
    const creator = 'GCREATOR1111111111111111111111111111111111111111111111111111';
    const now = Math.floor(Date.now() / 1000);
    currentSubs.push(
      makeSub({ id: 'sub-a', fan: 'GFAN_A', creator, expiryUnix: now + 7200, createdAt: new Date(Date.now() - 1000) }),
      makeSub({ id: 'sub-b', fan: 'GFAN_B', creator, expiryUnix: now + 3600, createdAt: new Date() }),
    );

    const result = await service.listCreatorSubscribers(creator, undefined, undefined, 20, 'expiry');

    expect(result.data[0].fanAddress).toBe('GFAN_B'); // earlier expiry first
    expect(result.data[1].fanAddress).toBe('GFAN_A');
  });

  it('listCreatorSubscribers sorts by created desc by default', async () => {
    const creator = 'GCREATOR2222222222222222222222222222222222222222222222222222';
    const now = Math.floor(Date.now() / 1000);
    currentSubs.push(
      makeSub({ id: 'sub-c', fan: 'GFAN_C', creator, expiryUnix: now + 3600, createdAt: new Date(Date.now() - 5000) }),
      makeSub({ id: 'sub-d', fan: 'GFAN_D', creator, expiryUnix: now + 3600, createdAt: new Date() }),
    );

    const result = await service.listCreatorSubscribers(creator, undefined, undefined, 20);

    expect(result.data[0].fanAddress).toBe('GFAN_D'); // most recently created first
    expect(result.data[1].fanAddress).toBe('GFAN_C');
  });

  it('listCreatorSubscribers filters by status=active', async () => {
    const creator = 'GCREATOR3333333333333333333333333333333333333333333333333333';
    const now = Math.floor(Date.now() / 1000);
    currentSubs.push(
      makeSub({ id: 'sub-e', fan: 'GFAN_E', creator, expiryUnix: now + 3600, status: SubscriptionStatus.ACTIVE }),
      makeSub({ id: 'sub-f', fan: 'GFAN_F', creator, expiryUnix: now - 3600, status: SubscriptionStatus.EXPIRED }),
    );

    const result = await service.listCreatorSubscribers(creator, 'active', undefined, 20);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].fanAddress).toBe('GFAN_E');
  });

  describe('cursor pagination', () => {
    it('returns nextCursor and hasMore on the first page', async () => {
      const fan = 'GFANPAG111111111111111111111111111111111111111111111111111';
      currentSubs.push(
        makeSub({ id: 'sub-1', fan, creator: 'GAAAAAAAAAAAAAAA' }),
        makeSub({ id: 'sub-2', fan, creator: 'GBBBBBBBBBBBBBBBB' }),
        makeSub({ id: 'sub-3', fan, creator: 'GCCCCCCCCCCCCCCCC' }),
      );

      const result = await service.listSubscriptions(fan, undefined, undefined, undefined, 2);

      expect(result.data).toHaveLength(2);
      expect(result.nextCursor).toBeTruthy();
      expect(result.hasMore).toBe(true);
    });

    it('returns the next slice when cursor is provided', async () => {
      const fan = 'GFANPAG222222222222222222222222222222222222222222222222222';
      currentSubs.push(
        makeSub({ id: 'sub-a', fan, creator: 'GAAAAAAAAAAAAAAA' }),
        makeSub({ id: 'sub-b', fan, creator: 'GBBBBBBBBBBBBBBBB' }),
        makeSub({ id: 'sub-c', fan, creator: 'GCCCCCCCCCCCCCCCC' }),
      );

      const result = await service.listSubscriptions(fan, undefined, undefined, 'sub-a', 2);

      expect(result.data.length).toBeGreaterThan(0);
      expect(repo.findWithCursor).toHaveBeenCalledWith(fan, undefined, undefined, 'sub-a', 2);
    });

    it('respects the limit parameter', async () => {
      const fan = 'GFANPAG333333333333333333333333333333333333333333333333333';
      currentSubs.push(
        makeSub({ id: 'sub-x', fan, creator: 'GAAAAAAAAAAAAAAA' }),
        makeSub({ id: 'sub-y', fan, creator: 'GBBBBBBBBBBBBBBBB' }),
      );

      const result = await service.listSubscriptions(fan, undefined, undefined, undefined, 1);

      expect(result.data).toHaveLength(1);
      expect(result.limit).toBe(1);
    });

    it('returns empty data for stale cursor without crashing', async () => {
      const fan = 'GFANPAG444444444444444444444444444444444444444444444444444';
      currentSubs.push(makeSub({ id: 'sub-z', fan, creator: 'GAAAAAAAAAAAAAAA' }));

      const result = await service.listSubscriptions(fan, undefined, undefined, 'sub-zzzz', 20);

      expect(result.data).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });
  });

  it('publishes a renewal event when confirming an existing subscription', async () => {
    const handler = jest.fn();
    eventBus.subscribe('subscription.renewed', handler);

    await service.addSubscription(
      'GFANADDRESS444444444444444444444444444444444444444444444444',
      'GAAAAAAAAAAAAAAA',
      1,
      Math.floor(Date.now() / 1000) + 60,
    );

    const checkout = service.createCheckout(
      'GFANADDRESS444444444444444444444444444444444444444444444444',
      'GAAAAAAAAAAAAAAA',
      1,
    );

    const result = await service.confirmSubscription(checkout.id, 'tx-renew');

    expect(result.lifecycleEvent).toBe('renewed');
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'subscription.renewed',
        fan: checkout.fanAddress,
        creator: checkout.creatorAddress,
      }),
    );
  });

  describe('happy path', () => {
    const fan = 'GFANHAPPY1111111111111111111111111111111111111111111111111';
    const creator = 'GAAAAAAAAAAAAAAA';

    it('addSubscription creates and returns a subscription entity', async () => {
      const expiry = Math.floor(Date.now() / 1000) + 3600;
      const result = await service.addSubscription(fan, creator, 1, expiry);

      expect(result).toMatchObject({ fan, creator, planId: 1, expiryUnix: expiry, status: SubscriptionStatus.ACTIVE });
      expect(repo.upsertManual).toHaveBeenCalledWith(expect.objectContaining({ fan, creator, planId: 1, expiryUnix: expiry }));
    });

    it('addSubscription publishes SubscriptionCreatedEvent', async () => {
      const handler = jest.fn();
      eventBus.subscribe('subscription.created', handler);

      await service.addSubscription(fan, creator, 1, Math.floor(Date.now() / 1000) + 3600);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'subscription.created', fan, creator }));
    });

    it('addSubscription sets status to expired when expiry is in the past', async () => {
      const pastExpiry = Math.floor(Date.now() / 1000) - 3600;
      const result = await service.addSubscription(fan, creator, 1, pastExpiry);

      expect(result.status).toBe(SubscriptionStatus.EXPIRED);
    });

    it('renewSubscription updates expiry and returns entity', async () => {
      await service.addSubscription(fan, creator, 1, Math.floor(Date.now() / 1000) + 60);
      const result = await service.renewSubscription(fan, creator, 1);

      expect(result).toMatchObject({ fan, creator, planId: 1, status: SubscriptionStatus.ACTIVE });
      expect(result.expiryUnix).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('renewSubscription accepts explicit expiry', async () => {
      const explicitExpiry = Math.floor(Date.now() / 1000) + 86400;
      await service.addSubscription(fan, creator, 1, Math.floor(Date.now() / 1000) + 60);
      const result = await service.renewSubscription(fan, creator, 1, explicitExpiry);

      expect(result.expiryUnix).toBe(explicitExpiry);
    });

    it('renewSubscription throws when plan does not belong to creator', async () => {
      await expect(service.renewSubscription(fan, 'GOTHER_CREATOR_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 1))
        .rejects.toThrow('Plan does not belong to the specified creator');
    });

    it('isSubscriber returns true for active subscription', async () => {
      await service.addSubscription(fan, creator, 1, Math.floor(Date.now() / 1000) + 3600);
      const result = await service.isSubscriber(fan, creator);
      expect(result).toBe(true);
    });

    it('isSubscriber returns false when no subscription exists', async () => {
      const result = await service.isSubscriber(fan, creator);
      expect(result).toBe(false);
    });

    it('getSubscription returns the subscription entity', async () => {
      await service.addSubscription(fan, creator, 1, Math.floor(Date.now() / 1000) + 3600);
      const result = await service.getSubscription(fan, creator);

      expect(result).not.toBeNull();
      expect(result!.fan).toBe(fan);
      expect(result!.creator).toBe(creator);
    });

    it('getSubscription returns null when none exists', async () => {
      const result = await service.getSubscription(fan, creator);
      expect(result).toBeNull();
    });

    it('cancelSubscription returns success result', async () => {
      await service.addSubscription(fan, creator, 1, Math.floor(Date.now() / 1000) + 3600);
      const result = await service.cancelSubscription(fan, creator);

      expect(result).toMatchObject({ success: true, fan, creator, status: SubscriptionStatus.CANCELLED });
      expect(result.cancelledAt).toBeDefined();
    });

    it('cancelSubscription throws NotFoundException when subscription does not exist', async () => {
      await expect(service.cancelSubscription(fan, creator)).rejects.toThrow('Subscription not found');
    });

    it('expireSubscription updates status to expired', async () => {
      await service.addSubscription(fan, creator, 1, Math.floor(Date.now() / 1000) + 3600);
      await service.expireSubscription(fan, creator);

      expect(repo.updateStatus).toHaveBeenCalledWith(fan, creator, SubscriptionStatus.EXPIRED);
    });

    it('createCheckout creates a pending checkout session', () => {
      const checkout = service.createCheckout(fan, creator, 1);

      expect(checkout).toMatchObject({
        fanAddress: fan,
        creatorAddress: creator,
        planId: 1,
        assetCode: 'XLM',
        status: 'pending',
      });
      expect(checkout.id).toBeDefined();
      expect(parseFloat(checkout.amount)).toBeGreaterThan(0);
      expect(parseFloat(checkout.fee)).toBeGreaterThan(0);
    });

    it('createCheckout throws when plan not found', () => {
      expect(() => service.createCheckout(fan, creator, 999)).toThrow('Plan not found');
    });

    it('getCheckout retrieves an existing checkout', () => {
      const checkout = service.createCheckout(fan, creator, 1);
      const retrieved = service.getCheckout(checkout.id);

      expect(retrieved.id).toBe(checkout.id);
      expect(retrieved.fanAddress).toBe(fan);
    });

    it('getCheckout throws when checkout not found', () => {
      expect(() => service.getCheckout('nonexistent')).toThrow('Checkout not found');
    });

    it('confirmSubscription creates new subscription and returns success', async () => {
      const checkout = service.createCheckout(fan, creator, 1);
      const result = await service.confirmSubscription(checkout.id, 'tx-hash-123');

      expect(result).toMatchObject({ success: true, status: 'completed', txHash: 'tx-hash-123', lifecycleEvent: 'created' });
      expect(result.subscriptionId).toBeDefined();
    });

    it('getPlanSummary returns plan details', () => {
      const summary = service.getPlanSummary(1);

      expect(summary).toMatchObject({ id: 1, creatorAddress: 'GAAAAAAAAAAAAAAA', assetCode: 'XLM' });
      expect(summary.amount).toBe('10');
      expect(summary.intervalDays).toBe(30);
    });

    it('getPlanSummary throws for non-existent plan', () => {
      expect(() => service.getPlanSummary(999)).toThrow('Plan not found');
    });

    it('getPriceBreakdown returns price components', () => {
      const checkout = service.createCheckout(fan, creator, 1);
      const breakdown = service.getPriceBreakdown(checkout.id);

      expect(breakdown).toMatchObject({ currency: 'XLM' });
      expect(parseFloat(breakdown.subtotal)).toBeGreaterThan(0);
      expect(parseFloat(breakdown.platformFee)).toBeGreaterThan(0);
      expect(parseFloat(breakdown.total)).toBeGreaterThan(0);
    });

    it('validateBalance returns valid for sufficient balance', () => {
      const result = service.validateBalance(fan, 'XLM', '10');
      expect(result).toMatchObject({ valid: true });
    });

    it('validateBalance returns invalid with shortfall for insufficient balance', () => {
      const result = service.validateBalance(fan, 'XLM', '2000');
      expect(result.valid).toBe(false);
      expect(result.shortfall).toBeDefined();
    });

    it('getWalletStatus returns balances for supported assets', () => {
      const wallet = service.getWalletStatus(fan);

      expect(wallet.address).toBe(fan);
      expect(wallet.isConnected).toBe(true);
      expect(wallet.balances.length).toBeGreaterThanOrEqual(2);
      expect(wallet.balances.find((b) => b.code === 'XLM')).toBeDefined();
    });

    it('getTransactionPreview returns preview for checkout', () => {
      const checkout = service.createCheckout(fan, creator, 1);
      const preview = service.getTransactionPreview(checkout.id);

      expect(preview).toMatchObject({ checkoutId: checkout.id, from: fan, to: creator });
      expect(parseFloat(preview.amount)).toBeGreaterThan(0);
    });

    it('failCheckout marks checkout as failed', () => {
      const checkout = service.createCheckout(fan, creator, 1);
      const result = service.failCheckout(checkout.id, 'network error');

      expect(result).toMatchObject({ success: false, status: 'failed', error: 'network error' });
    });

    it('failCheckout marks checkout as rejected when isRejected is true', () => {
      const checkout = service.createCheckout(fan, creator, 1);
      const result = service.failCheckout(checkout.id, 'user rejected', true);

      expect(result).toMatchObject({ success: false, status: 'rejected' });
    });

    it('assertNetworkMatch does nothing when network is undefined', () => {
      expect(() => service.assertNetworkMatch(undefined)).not.toThrow();
    });

    it('assertNetworkMatch throws for mismatched network', () => {
      expect(() => service.assertNetworkMatch('mainnet')).toThrow();
    });

    it('getFanDashboardSummary returns dashboard with pagination', async () => {
      await service.addSubscription(fan, creator, 1, Math.floor(Date.now() / 1000) + 3600);
      const result = await service.getFanDashboardSummary(fan, 1, 20);

      expect(result.fan).toBe(fan);
      expect(result.totalActive).toBeGreaterThanOrEqual(1);
      expect(result.subscriptions).toBeInstanceOf(Array);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('getCompletedPayments returns completed checkouts', async () => {
      const checkout = service.createCheckout(fan, creator, 1);
      await service.confirmSubscription(checkout.id, 'tx-pay');

      const payments = service.getCompletedPayments();
      expect(payments.some((p) => p.txHash === 'tx-pay')).toBe(true);
    });

    it('getAllSubscriptionsInternal delegates to repository', async () => {
      await service.getAllSubscriptionsInternal();
      expect(repo.findAllForReconciler).toHaveBeenCalled();
    });
  });

  it('publishes a cancelled event when subscription is cancelled', async () => {
    const handler = jest.fn();
    eventBus.subscribe('subscription.cancelled', handler);

    const subscription = await service.addSubscription(
      'GFANADDRESS555555555555555555555555555555555555555555555555',
      'GAAAAAAAAAAAAAAA',
      1,
      Math.floor(Date.now() / 1000) + 60,
    );

    const result = await service.cancelSubscription(
      'GFANADDRESS555555555555555555555555555555555555555555555555',
      'GAAAAAAAAAAAAAAA',
    );

    expect(result.subscriptionId).toBe(subscription.id);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'subscription.cancelled',
        subscriptionId: subscription.id,
      }),
    );
  });
});
