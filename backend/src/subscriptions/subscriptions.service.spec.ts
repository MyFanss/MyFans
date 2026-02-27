import { Test, TestingModule } from '@nestjs/testing';
import {
  SUBSCRIPTION_EVENT_PUBLISHER,
  SUBSCRIPTION_RENEWAL_FAILED,
  SubscriptionEventPublisher,
} from './events';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let eventPublisher: jest.Mocked<SubscriptionEventPublisher>;

  beforeEach(async () => {
    eventPublisher = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: SUBSCRIPTION_EVENT_PUBLISHER,
          useValue: eventPublisher,
        },
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

    beforeEach(() => {
      service = new SubscriptionsService();
    });

    it('should return empty paginated response when fan has no subscriptions', () => {
      const result = service.listSubscriptions(fan);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(0);
    });

    it('should return all subscriptions in a single page', () => {
      const creator = 'GBBD47ZY6F6R7OGMW5G6C5R5P6NQ5QW5R5V5S5R5O5P5Q5R5V5S5R5O5';
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
      // Add 3 subscriptions to different creators
      service.addSubscription(fan, 'CREATOR_A_XXXXXXX', 1, expiry);
      service.addSubscription(fan, 'CREATOR_B_XXXXXXX', 1, expiry + 100);
      service.addSubscription(fan, 'CREATOR_C_XXXXXXX', 1, expiry + 200);

      // Page 1 with limit 2
      const page1 = service.listSubscriptions(fan, undefined, undefined, 1, 2);
      expect(page1.data).toHaveLength(2);
      expect(page1.total).toBe(3);
      expect(page1.page).toBe(1);
      expect(page1.limit).toBe(2);
      expect(page1.totalPages).toBe(2);

      // Page 2 with limit 2
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
      service.addSubscription(fan, 'CREATOR_B_XXXXXXX', 1, pastExpiry); // will be expired

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

      const result = service.listSubscriptions(fan, undefined, undefined, 5, 20);
      expect(result.data).toEqual([]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(5);
      expect(result.totalPages).toBe(1);
    });
  });
});
