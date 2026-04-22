import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from './subscriptions.service';
import { EventBus } from '../events/event-bus';
import { InProcessEventBus } from '../events/in-process-event-bus';
import { SubscriptionChainReaderService } from './subscription-chain-reader.service';

describe('Subscription Expiry Consistency', () => {
  let service: SubscriptionsService;
  let eventBus: EventBus;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: EventBus, useClass: InProcessEventBus },
        {
          provide: SubscriptionChainReaderService,
          useValue: {
            getConfiguredContractId: jest.fn().mockReturnValue(null),
            readIsSubscriber: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    eventBus = module.get<EventBus>(EventBus);
  });

  describe('Expiry calculation helper', () => {
    it('should calculate expiry timestamp correctly for 30-day interval', () => {
      const beforeTime = Math.floor(Date.now() / 1000);
      
      // Access private method through any type casting for testing
      const expiry = (service as any).calculateExpiryTimestamp(30);
      
      const afterTime = Math.floor(Date.now() / 1000);
      const expectedMinExpiry = beforeTime + 30 * 24 * 60 * 60;
      const expectedMaxExpiry = afterTime + 30 * 24 * 60 * 60;

      expect(expiry).toBeGreaterThanOrEqual(expectedMinExpiry);
      expect(expiry).toBeLessThanOrEqual(expectedMaxExpiry);
    });

    it('should calculate expiry timestamp correctly for 7-day interval', () => {
      const beforeTime = Math.floor(Date.now() / 1000);
      
      const expiry = (service as any).calculateExpiryTimestamp(7);
      
      const afterTime = Math.floor(Date.now() / 1000);
      const expectedMinExpiry = beforeTime + 7 * 24 * 60 * 60;
      const expectedMaxExpiry = afterTime + 7 * 24 * 60 * 60;

      expect(expiry).toBeGreaterThanOrEqual(expectedMinExpiry);
      expect(expiry).toBeLessThanOrEqual(expectedMaxExpiry);
    });

    it('should calculate expiry timestamp correctly for 365-day interval', () => {
      const beforeTime = Math.floor(Date.now() / 1000);
      
      const expiry = (service as any).calculateExpiryTimestamp(365);
      
      const afterTime = Math.floor(Date.now() / 1000);
      const expectedMinExpiry = beforeTime + 365 * 24 * 60 * 60;
      const expectedMaxExpiry = afterTime + 365 * 24 * 60 * 60;

      expect(expiry).toBeGreaterThanOrEqual(expectedMinExpiry);
      expect(expiry).toBeLessThanOrEqual(expectedMaxExpiry);
    });

    it('should calculate expiry timestamp correctly for 1-day interval', () => {
      const beforeTime = Math.floor(Date.now() / 1000);
      
      const expiry = (service as any).calculateExpiryTimestamp(1);
      
      const afterTime = Math.floor(Date.now() / 1000);
      const expectedMinExpiry = beforeTime + 1 * 24 * 60 * 60;
      const expectedMaxExpiry = afterTime + 1 * 24 * 60 * 60;

      expect(expiry).toBeGreaterThanOrEqual(expectedMinExpiry);
      expect(expiry).toBeLessThanOrEqual(expectedMaxExpiry);
    });

    it('should throw error on overflow risk', () => {
      // Try to calculate with a very large interval that would overflow
      const largeInterval = Number.MAX_SAFE_INTEGER;
      
      expect(() => {
        (service as any).calculateExpiryTimestamp(largeInterval);
      }).toThrow('Expiry calculation would overflow');
    });

    it('should handle edge case of zero interval', () => {
      const beforeTime = Math.floor(Date.now() / 1000);
      
      const expiry = (service as any).calculateExpiryTimestamp(0);
      
      const afterTime = Math.floor(Date.now() / 1000);

      expect(expiry).toBeGreaterThanOrEqual(beforeTime);
      expect(expiry).toBeLessThanOrEqual(afterTime + 1);
    });
  });

  describe('Expiry consistency across subscription flows', () => {
    const fanAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
    const creatorAddress = 'GAAAAAAAAAAAAAAA';
    const planId = 1;

    it('should use consistent expiry when confirming subscription', () => {
      const checkout = service.createCheckout(
        fanAddress,
        creatorAddress,
        planId,
        'XLM',
      );

      const beforeTime = Math.floor(Date.now() / 1000);
      service.confirmSubscription(checkout.id);
      const afterTime = Math.floor(Date.now() / 1000);

      const subscription = service.getSubscription(fanAddress, creatorAddress);
      expect(subscription).toBeDefined();
      expect(subscription!.expiry).toBeGreaterThanOrEqual(beforeTime + 30 * 24 * 60 * 60);
      expect(subscription!.expiry).toBeLessThanOrEqual(afterTime + 30 * 24 * 60 * 60);
    });

    it('should maintain expiry consistency across multiple subscriptions', () => {
      const fan1 = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
      const fan2 = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2I';
      const creator = 'GAAAAAAAAAAAAAAA';

      const checkout1 = service.createCheckout(fan1, creator, planId, 'XLM');
      const checkout2 = service.createCheckout(fan2, creator, planId, 'XLM');

      const beforeTime = Math.floor(Date.now() / 1000);
      service.confirmSubscription(checkout1.id);
      service.confirmSubscription(checkout2.id);
      const afterTime = Math.floor(Date.now() / 1000);

      const sub1 = service.getSubscription(fan1, creator);
      const sub2 = service.getSubscription(fan2, creator);

      expect(sub1).toBeDefined();
      expect(sub2).toBeDefined();

      // Both should have expiry within the same time window
      const expectedMinExpiry = beforeTime + 30 * 24 * 60 * 60;
      const expectedMaxExpiry = afterTime + 30 * 24 * 60 * 60;

      expect(sub1!.expiry).toBeGreaterThanOrEqual(expectedMinExpiry);
      expect(sub1!.expiry).toBeLessThanOrEqual(expectedMaxExpiry);
      expect(sub2!.expiry).toBeGreaterThanOrEqual(expectedMinExpiry);
      expect(sub2!.expiry).toBeLessThanOrEqual(expectedMaxExpiry);
    });

    it('should use plan interval days for expiry calculation', () => {
      // Plan 1 has 30-day interval
      const checkout1 = service.createCheckout(
        fanAddress,
        creatorAddress,
        1, // 30-day plan
        'XLM',
      );

      const beforeTime = Math.floor(Date.now() / 1000);
      service.confirmSubscription(checkout1.id);
      const afterTime = Math.floor(Date.now() / 1000);

      const subscription = service.getSubscription(fanAddress, creatorAddress);
      expect(subscription).toBeDefined();

      // Should be approximately 30 days from now
      const expectedMinExpiry = beforeTime + 30 * 24 * 60 * 60;
      const expectedMaxExpiry = afterTime + 30 * 24 * 60 * 60;

      expect(subscription!.expiry).toBeGreaterThanOrEqual(expectedMinExpiry);
      expect(subscription!.expiry).toBeLessThanOrEqual(expectedMaxExpiry);
    });

    it('should emit subscription created event with correct expiry', (done) => {
      const handler = jest.fn();
      eventBus.subscribe('subscription.created', handler);

      const checkout = service.createCheckout(
        fanAddress,
        creatorAddress,
        planId,
        'XLM',
      );

      const beforeTime = Math.floor(Date.now() / 1000);
      service.confirmSubscription(checkout.id);
      const afterTime = Math.floor(Date.now() / 1000);

      // Give event bus time to process
      setTimeout(() => {
        expect(handler).toHaveBeenCalled();
        const event = handler.mock.calls[0][0];
        
        const expectedMinExpiry = beforeTime + 30 * 24 * 60 * 60;
        const expectedMaxExpiry = afterTime + 30 * 24 * 60 * 60;

        expect(event.expiry).toBeGreaterThanOrEqual(expectedMinExpiry);
        expect(event.expiry).toBeLessThanOrEqual(expectedMaxExpiry);
        done();
      }, 10);
    });
  });

  describe('Regression tests for expiry edge cases', () => {
    const fanAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
    const creatorAddress = 'GAAAAAAAAAAAAAAA';

    it('should not have expiry in the past after subscription creation', () => {
      const checkout = service.createCheckout(
        fanAddress,
        creatorAddress,
        1,
        'XLM',
      );

      service.confirmSubscription(checkout.id);

      const subscription = service.getSubscription(fanAddress, creatorAddress);
      const nowSec = Math.floor(Date.now() / 1000);

      expect(subscription).toBeDefined();
      expect(subscription!.expiry).toBeGreaterThan(nowSec);
    });

    it('should have expiry greater than current time by at least 29 days', () => {
      const checkout = service.createCheckout(
        fanAddress,
        creatorAddress,
        1,
        'XLM',
      );

      service.confirmSubscription(checkout.id);

      const subscription = service.getSubscription(fanAddress, creatorAddress);
      const nowSec = Math.floor(Date.now() / 1000);
      const minExpiry = nowSec + 29 * 24 * 60 * 60;

      expect(subscription).toBeDefined();
      expect(subscription!.expiry).toBeGreaterThan(minExpiry);
    });

    it('should have expiry less than current time plus 31 days', () => {
      const checkout = service.createCheckout(
        fanAddress,
        creatorAddress,
        1,
        'XLM',
      );

      service.confirmSubscription(checkout.id);

      const subscription = service.getSubscription(fanAddress, creatorAddress);
      const nowSec = Math.floor(Date.now() / 1000);
      const maxExpiry = nowSec + 31 * 24 * 60 * 60;

      expect(subscription).toBeDefined();
      expect(subscription!.expiry).toBeLessThan(maxExpiry);
    });

    it('should maintain expiry consistency when subscription is retrieved', () => {
      const checkout = service.createCheckout(
        fanAddress,
        creatorAddress,
        1,
        'XLM',
      );

      service.confirmSubscription(checkout.id);

      const subscription1 = service.getSubscription(fanAddress, creatorAddress);
      const subscription2 = service.getSubscription(fanAddress, creatorAddress);

      expect(subscription1).toBeDefined();
      expect(subscription2).toBeDefined();
      expect(subscription1!.expiry).toBe(subscription2!.expiry);
    });

    it('should correctly identify active subscription before expiry', () => {
      const checkout = service.createCheckout(
        fanAddress,
        creatorAddress,
        1,
        'XLM',
      );

      service.confirmSubscription(checkout.id);

      const isSubscriber = service.isSubscriber(fanAddress, creatorAddress);
      expect(isSubscriber).toBe(true);
    });
  });
});
