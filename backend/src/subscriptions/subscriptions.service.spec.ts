import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '../events/event-bus';
import { InProcessEventBus } from '../events/in-process-event-bus';
import { SubscriptionChainReaderService } from './subscription-chain-reader.service';
import { SERVER_NETWORK, SubscriptionsService } from './subscriptions.service';
import {
  SUBSCRIPTION_EVENT_PUBLISHER,
  SUBSCRIPTION_RENEWAL_FAILED,
  SubscriptionEventPublisher,
} from './events';

function makeChainReader(): SubscriptionChainReaderService {
  return {
    getConfiguredContractId: jest.fn().mockReturnValue(undefined),
    readIsSubscriber: jest.fn(),
  } as unknown as SubscriptionChainReaderService;
}

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let eventPublisher: jest.Mocked<SubscriptionEventPublisher>;
  let eventBus: InProcessEventBus;

  beforeEach(async () => {
    eventPublisher = { emit: jest.fn() };
    eventBus = new InProcessEventBus();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: EventBus, useValue: eventBus },
        { provide: SubscriptionChainReaderService, useValue: makeChainReader() },
        { provide: SUBSCRIPTION_EVENT_PUBLISHER, useValue: eventPublisher },
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

  it('does not throw when event emission fails', async () => {
    eventPublisher.emit.mockRejectedValue(new Error('publish failed'));

    const checkout = service.createCheckout(
      'GFANADDRESS222222222222222222222222222222222222222222222222',
      'GAAAAAAAAAAAAAAA',
      1,
    );

    expect(() =>
      service.failCheckout(checkout.id, 'transaction reverted'),
    ).not.toThrow();

    await Promise.resolve();

    expect(eventPublisher.emit).toHaveBeenCalledWith(
      SUBSCRIPTION_RENEWAL_FAILED,
      expect.objectContaining({
        subscriptionId: checkout.id,
        reason: 'transaction reverted',
      }),
    );
  });

  describe('listSubscriptions', () => {
    const fan = 'GAAAAAAAAAAAAAAA';

    it('should return empty paginated response when fan has no subscriptions', () => {
      const result = service.listSubscriptions(fan);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(0);
    });

    it('should return all subscriptions in a single page', () => {
      const creator =
        'GBBD47ZY6F6R7OGMW5G6C5R5P6NQ5QW5R5V5S5R5O5P5Q5R5V5S5R5O5';
      const expiry = Math.floor(Date.now() / 1000) + 86400;
      service.addSubscription(fan, creator, 1, expiry);

      const result = service.listSubscriptions(fan);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.data[0].creatorId).toBe(creator);
    });

    it('should paginate results across multiple pages', () => {
      const expiry = Math.floor(Date.now() / 1000) + 86400;
      service.addSubscription(fan, 'CREATOR_A_XXXXXXX', 1, expiry);
      service.addSubscription(fan, 'CREATOR_B_XXXXXXX', 1, expiry + 100);
      service.addSubscription(fan, 'CREATOR_C_XXXXXXX', 1, expiry + 200);

      const page1 = service.listSubscriptions(fan, undefined, undefined, 1, 2);
      expect(page1.data).toHaveLength(2);
      expect(page1.total).toBe(3);
      expect(page1.page).toBe(1);
      expect(page1.limit).toBe(2);
      expect(page1.totalPages).toBe(2);

      const page2 = service.listSubscriptions(fan, undefined, undefined, 2, 2);
      expect(page2.data).toHaveLength(1);
      expect(page2.total).toBe(3);
      expect(page2.page).toBe(2);
      expect(page2.totalPages).toBe(2);
    });

    it('should filter by status', () => {
      const expiry = Math.floor(Date.now() / 1000) + 86400;
      const pastExpiry = Math.floor(Date.now() / 1000) - 86400;
      service.addSubscription(fan, 'CREATOR_A_XXXXXXX', 1, expiry);
      service.addSubscription(fan, 'CREATOR_B_XXXXXXX', 1, pastExpiry);

      const activeOnly = service.listSubscriptions(fan, 'active');
      expect(activeOnly.data).toHaveLength(1);
      expect(activeOnly.total).toBe(1);

      const expiredOnly = service.listSubscriptions(fan, 'expired');
      expect(expiredOnly.data).toHaveLength(1);
      expect(expiredOnly.total).toBe(1);
    });

    it('should return empty page when page exceeds total pages', () => {
      const expiry = Math.floor(Date.now() / 1000) + 86400;
      service.addSubscription(fan, 'CREATOR_A_XXXXXXX', 1, expiry);

      const result = service.listSubscriptions(
        fan,
        undefined,
        undefined,
        5,
        20,
      );
      expect(result.data).toEqual([]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(5);
      expect(result.totalPages).toBe(1);
    });
  });

  it('publishes a renewal event when confirming an existing subscription', () => {
    const handler = jest.fn();
    eventBus.subscribe('subscription.renewed', handler);

    service.addSubscription(
      'GFANADDRESS333333333333333333333333333333333333333333333333',
      'GAAAAAAAAAAAAAAA',
      1,
      Math.floor(Date.now() / 1000) + 60,
    );

    const checkout = service.createCheckout(
      'GFANADDRESS333333333333333333333333333333333333333333333333',
      'GAAAAAAAAAAAAAAA',
      1,
    );

    const result = service.confirmSubscription(checkout.id, 'tx-renew');

    expect(result.lifecycleEvent).toBe('renewed');
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'subscription.renewed',
        fan: checkout.fanAddress,
        creator: checkout.creatorAddress,
      }),
    );
  });

  it('publishes a cancelled event when subscription is cancelled', () => {
    const handler = jest.fn();
    eventBus.subscribe('subscription.cancelled', handler);

    const subscription = service.addSubscription(
      'GFANADDRESS444444444444444444444444444444444444444444444444',
      'GAAAAAAAAAAAAAAA',
      1,
      Math.floor(Date.now() / 1000) + 60,
    );

    const result = service.cancelSubscription(
      'GFANADDRESS444444444444444444444444444444444444444444444444',
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

  describe('listCreatorSubscribers', () => {
    const creator = 'GCREATOR111111111111111111111111111111111111111111111111';

    it('returns empty paginated response when creator has no subscribers', () => {
      const result = service.listCreatorSubscribers(creator);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(0);
    });

    it('returns creator subscribers with derived active/expired status', () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
      const pastExpiry = Math.floor(Date.now() / 1000) - 3600;

      service.addSubscription(
        'GFANACTIVE111111111111111111111111111111111111111111111111',
        creator,
        1,
        futureExpiry,
      );
      service.addSubscription(
        'GFANEXPIRED11111111111111111111111111111111111111111111111',
        creator,
        2,
        pastExpiry,
      );
      service.addSubscription(
        'GFANOTHERCR11111111111111111111111111111111111111111111111',
        'GOTHERCREATOR111111111111111111111111111111111111111111111',
        1,
        futureExpiry,
      );

      const result = service.listCreatorSubscribers(creator);

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.data.map((sub) => sub.status).sort()).toEqual([
        'active',
        'expired',
      ]);
      expect(result.data.every((sub) => sub.creatorAddress === creator)).toBe(true);
    });

    it('filters by active and expired status', () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
      const pastExpiry = Math.floor(Date.now() / 1000) - 3600;

      service.addSubscription(
        'GFANACTIVEF11111111111111111111111111111111111111111111111',
        creator,
        1,
        futureExpiry,
      );
      service.addSubscription(
        'GFANEXPIREDF1111111111111111111111111111111111111111111111',
        creator,
        1,
        pastExpiry,
      );

      const activeOnly = service.listCreatorSubscribers(creator, 'active');
      const expiredOnly = service.listCreatorSubscribers(creator, 'expired');

      expect(activeOnly.total).toBe(1);
      expect(activeOnly.data[0].status).toBe('active');
      expect(expiredOnly.total).toBe(1);
      expect(expiredOnly.data[0].status).toBe('expired');
    });

    it('paginates creator subscribers', () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 3600;

      service.addSubscription(
        'GFANPAGEA1111111111111111111111111111111111111111111111111',
        creator,
        1,
        futureExpiry,
      );
      service.addSubscription(
        'GFANPAGEB1111111111111111111111111111111111111111111111111',
        creator,
        1,
        futureExpiry + 100,
      );
      service.addSubscription(
        'GFANPAGEC1111111111111111111111111111111111111111111111111',
        creator,
        1,
        futureExpiry + 200,
      );

      const page1 = service.listCreatorSubscribers(creator, undefined, 1, 2);
      const page2 = service.listCreatorSubscribers(creator, undefined, 2, 2);

      expect(page1.total).toBe(3);
      expect(page1.data).toHaveLength(2);
      expect(page1.totalPages).toBe(2);

      expect(page2.total).toBe(3);
      expect(page2.data).toHaveLength(1);
      expect(page2.page).toBe(2);
      expect(page2.totalPages).toBe(2);
    });
  });

  describe('assertNetworkMatch (network mismatch detection)', () => {
    it('does not throw when requestNetwork matches server network', () => {
      expect(() => service.assertNetworkMatch(SERVER_NETWORK)).not.toThrow();
    });

    it('does not throw when requestNetwork is undefined', () => {
      expect(() => service.assertNetworkMatch(undefined)).not.toThrow();
    });

    it('throws NETWORK_MISMATCH error when networks differ', () => {
      const wrongNetwork =
        SERVER_NETWORK === 'testnet' ? 'mainnet' : 'testnet';
      expect(() => service.assertNetworkMatch(wrongNetwork)).toThrow();
    });

    it('error response includes expectedNetwork and currentNetwork', () => {
      const wrongNetwork =
        SERVER_NETWORK === 'testnet' ? 'mainnet' : 'testnet';
      try {
        service.assertNetworkMatch(wrongNetwork);
        fail('Expected an error to be thrown');
      } catch (err: unknown) {
        const body = (err as { response: Record<string, string> }).response;
        expect(body.error).toBe('NETWORK_MISMATCH');
        expect(body.expectedNetwork).toBe(SERVER_NETWORK);
        expect(body.currentNetwork).toBe(wrongNetwork);
      }
    });

    it('createCheckout throws NETWORK_MISMATCH when networks differ', () => {
      const wrongNetwork =
        SERVER_NETWORK === 'testnet' ? 'mainnet' : 'testnet';
      expect(() =>
        service.createCheckout(
          'GFANADDRESS111111111111111111111111111111111111111111111111',
          'GAAAAAAAAAAAAAAA',
          1,
          'XLM',
          undefined,
          wrongNetwork,
        ),
      ).toThrow();
    });

    it('createCheckout succeeds when network matches', () => {
      expect(() =>
        service.createCheckout(
          'GFANADDRESS111111111111111111111111111111111111111111111111',
          'GAAAAAAAAAAAAAAA',
          1,
          'XLM',
          undefined,
          SERVER_NETWORK,
        ),
      ).not.toThrow();
    });
  });

  describe('getFanDashboardSummary', () => {
    const fan = `G${'D'.repeat(55)}`;
    const creator1 = `G${'E'.repeat(55)}`;
    const creator2 = `G${'F'.repeat(55)}`;

    it('returns empty summary when fan has no active subscriptions', () => {
      const result = service.getFanDashboardSummary(fan);
      expect(result.fan).toBe(fan);
      expect(result.totalActive).toBe(0);
      expect(result.subscriptions).toEqual([]);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(0);
    });

    it('returns only active subscriptions with correct renewsAt', () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 86400;
      const pastExpiry = Math.floor(Date.now() / 1000) - 86400;
      service.addSubscription(fan, creator1, 1, futureExpiry);
      service.addSubscription(fan, creator2, 1, pastExpiry);

      const result = service.getFanDashboardSummary(fan);
      expect(result.totalActive).toBe(1);
      expect(result.subscriptions).toHaveLength(1);
      expect(result.subscriptions[0].creatorId).toBe(creator1);
      expect(result.subscriptions[0].renewsAtUnix).toBe(futureExpiry);
      expect(result.subscriptions[0].status).toBe('active');
    });

    it('paginates active subscriptions', () => {
      const expiry = Math.floor(Date.now() / 1000) + 86400;
      service.addSubscription(fan, `G${'G'.repeat(55)}`, 1, expiry);
      service.addSubscription(fan, `G${'H'.repeat(55)}`, 1, expiry + 100);
      service.addSubscription(fan, `G${'I'.repeat(55)}`, 1, expiry + 200);

      const page1 = service.getFanDashboardSummary(fan, 1, 2);
      expect(page1.totalActive).toBe(3);
      expect(page1.subscriptions).toHaveLength(2);
      expect(page1.totalPages).toBe(2);

      const page2 = service.getFanDashboardSummary(fan, 2, 2);
      expect(page2.subscriptions).toHaveLength(1);
      expect(page2.page).toBe(2);
    });

    it('sorts subscriptions by soonest renewsAt first', () => {
      const now = Math.floor(Date.now() / 1000);
      const creatorA = `G${'J'.repeat(55)}`;
      const creatorB = `G${'K'.repeat(55)}`;
      service.addSubscription(fan, creatorA, 1, now + 7200);
      service.addSubscription(fan, creatorB, 1, now + 3600);

      const result = service.getFanDashboardSummary(fan);
      expect(result.subscriptions[0].creatorId).toBe(creatorB);
      expect(result.subscriptions[1].creatorId).toBe(creatorA);
    });
  });

  describe('getFanCreatorSubscriptionState', () => {
    const fan = `G${'A'.repeat(55)}`;
    const creator = `G${'B'.repeat(55)}`;

    it('rejects when fan equals creator', async () => {
      await expect(
        service.getFanCreatorSubscriptionState(fan, fan),
      ).rejects.toThrow(/different/);
    });

    it('returns none when no subscription', async () => {
      const result = await service.getFanCreatorSubscriptionState(fan, creator);
      expect(result.indexedStatus).toBe('none');
      expect(result.active).toBe(false);
      expect(result.indexed).toBeNull();
      expect(result.chain.configured).toBe(false);
    });

    it('returns active with expiry when indexed subscription exists', async () => {
      const future = Math.floor(Date.now() / 1000) + 3600;
      service.addSubscription(fan, creator, 1, future);
      const result = await service.getFanCreatorSubscriptionState(fan, creator);
      expect(result.active).toBe(true);
      expect(result.indexedStatus).toBe('active');
      expect(result.indexed?.expiresAtUnix).toBe(future);
      expect(result.indexed?.planId).toBe(1);
    });
  });
});
