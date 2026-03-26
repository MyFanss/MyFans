import { Test, TestingModule } from '@nestjs/testing';
import {
  SUBSCRIPTION_EVENT_PUBLISHER,
  SUBSCRIPTION_RENEWAL_FAILED,
  SubscriptionEventPublisher,
} from './events';
import { SubscriptionsService, SERVER_NETWORK } from './subscriptions.service';
import { EventBus } from '../events/event-bus';

function makeEventBus(): EventBus {
  return { publish: jest.fn() } as unknown as EventBus;
}

async function buildService(
  eventPublisher?: jest.Mocked<SubscriptionEventPublisher>,
): Promise<SubscriptionsService> {
  const providers: object[] = [
    SubscriptionsService,
    { provide: EventBus, useValue: makeEventBus() },
  ];
  if (eventPublisher) {
    providers.push({
      provide: SUBSCRIPTION_EVENT_PUBLISHER,
      useValue: eventPublisher,
    });
  }
  const module: TestingModule = await Test.createTestingModule({
    providers,
  }).compile();
  return module.get<SubscriptionsService>(SubscriptionsService);
}

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let eventPublisher: jest.Mocked<SubscriptionEventPublisher>;

  beforeEach(async () => {
    eventPublisher = { emit: jest.fn() };
    service = await buildService(eventPublisher);
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
});
