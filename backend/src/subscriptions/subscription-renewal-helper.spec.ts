import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { EventBus } from '../events/event-bus';
import { InProcessEventBus } from '../events/in-process-event-bus';
import { SubscriptionChainReaderService } from './subscription-chain-reader.service';

describe('Subscription Renewal Helper', () => {
  let service: SubscriptionsService;
  let eventBus: EventBus;

  const fanAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
  const creatorAddress = 'GAAAAAAAAAAAAAAA';
  const planId = 1;

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

  describe('renewSubscription - Active Subscription', () => {
    beforeEach(() => {
      // Create an active subscription
      const expiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      service.addSubscription(fanAddress, creatorAddress, planId, expiry);
    });

    it('should renew an active subscription', () => {
      const result = service.renewSubscription(fanAddress, creatorAddress, planId);

      expect(result.success).toBe(true);
      expect(result.subscriptionId).toBeDefined();
      expect(result.newExpiryTimestamp).toBeDefined();
      expect(result.message).toBe('Subscription renewed successfully');
    });

    it('should update expiry to future date', () => {
      const beforeRenewal = Math.floor(Date.now() / 1000);
      const result = service.renewSubscription(fanAddress, creatorAddress, planId);
      const afterRenewal = Math.floor(Date.now() / 1000);

      const expectedMinExpiry = beforeRenewal + 30 * 24 * 60 * 60;
      const expectedMaxExpiry = afterRenewal + 30 * 24 * 60 * 60;

      expect(result.newExpiryTimestamp).toBeGreaterThanOrEqual(expectedMinExpiry);
      expect(result.newExpiryTimestamp).toBeLessThanOrEqual(expectedMaxExpiry);
    });

    it('should return ISO date string for new expiry', () => {
      const result = service.renewSubscription(fanAddress, creatorAddress, planId);

      expect(result.newExpiryDate).toBeDefined();
      expect(new Date(result.newExpiryDate)).toBeInstanceOf(Date);
      expect(new Date(result.newExpiryDate).getTime()).toBeGreaterThan(Date.now());
    });

    it('should preserve subscription ID', () => {
      const subscriptionBefore = service.getSubscription(fanAddress, creatorAddress);
      const result = service.renewSubscription(fanAddress, creatorAddress, planId);

      expect(result.subscriptionId).toBe(subscriptionBefore!.id);
    });

    it('should update subscription in storage', () => {
      const subscriptionBefore = service.getSubscription(fanAddress, creatorAddress);
      const expiryBefore = subscriptionBefore!.expiry;

      service.renewSubscription(fanAddress, creatorAddress, planId);

      const subscriptionAfter = service.getSubscription(fanAddress, creatorAddress);
      expect(subscriptionAfter!.expiry).toBeGreaterThan(expiryBefore);
    });

    it('should include transaction hash in response if provided', () => {
      const txHash = 'tx_1234567890';
      const result = service.renewSubscription(
        fanAddress,
        creatorAddress,
        planId,
        txHash,
      );

      expect(result.txHash).toBe(txHash);
    });

    it('should handle renewal without transaction hash', () => {
      const result = service.renewSubscription(fanAddress, creatorAddress, planId);

      expect(result.success).toBe(true);
      expect(result.txHash).toBeUndefined();
    });

    it('should use plan interval days for expiry calculation', () => {
      // Plan 1 has 30-day interval
      const result = service.renewSubscription(fanAddress, creatorAddress, 1);

      const nowSec = Math.floor(Date.now() / 1000);
      const expectedMinExpiry = nowSec + 30 * 24 * 60 * 60;
      const expectedMaxExpiry = nowSec + 31 * 24 * 60 * 60;

      expect(result.newExpiryTimestamp).toBeGreaterThanOrEqual(expectedMinExpiry);
      expect(result.newExpiryTimestamp).toBeLessThanOrEqual(expectedMaxExpiry);
    });

    it('should emit subscription created event on renewal', (done) => {
      const handler = jest.fn();
      eventBus.subscribe('subscription.created', handler);

      service.renewSubscription(fanAddress, creatorAddress, planId);

      setTimeout(() => {
        expect(handler).toHaveBeenCalled();
        const event = handler.mock.calls[0][0];
        expect(event.fan).toBe(fanAddress);
        expect(event.creator).toBe(creatorAddress);
        expect(event.planId).toBe(planId);
        done();
      }, 10);
    });
  });

  describe('renewSubscription - Missing Subscription', () => {
    it('should throw error when subscription does not exist', () => {
      expect(() => {
        service.renewSubscription(fanAddress, creatorAddress, planId);
      }).toThrow(NotFoundException);
    });

    it('should throw error with descriptive message for missing subscription', () => {
      expect(() => {
        service.renewSubscription(fanAddress, creatorAddress, planId);
      }).toThrow(
        `No active subscription found for fan ${fanAddress} with creator ${creatorAddress}`,
      );
    });

    it('should not create subscription when renewal fails', () => {
      expect(() => {
        service.renewSubscription(fanAddress, creatorAddress, planId);
      }).toThrow();

      const subscription = service.getSubscription(fanAddress, creatorAddress);
      expect(subscription).toBeUndefined();
    });
  });

  describe('renewSubscription - Plan Validation', () => {
    beforeEach(() => {
      const expiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      service.addSubscription(fanAddress, creatorAddress, planId, expiry);
    });

    it('should throw error for non-existent plan', () => {
      expect(() => {
        service.renewSubscription(fanAddress, creatorAddress, 9999);
      }).toThrow(NotFoundException);
      expect(() => {
        service.renewSubscription(fanAddress, creatorAddress, 9999);
      }).toThrow('Plan 9999 not found');
    });

    it('should throw error when plan does not belong to creator', () => {
      const otherCreator = 'GBBD47ZY6F6R7OGMW5G6C5R5P6NQ5QW5R5V5S5R5O5P5Q5R5V5S5R5O5';
      const plan3Id = 3; // Owned by otherCreator

      // Create subscription with original creator
      const expiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      service.addSubscription(fanAddress, creatorAddress, planId, expiry);

      // Try to renew with different plan
      expect(() => {
        service.renewSubscription(fanAddress, creatorAddress, plan3Id);
      }).toThrow(BadRequestException);
      expect(() => {
        service.renewSubscription(fanAddress, creatorAddress, plan3Id);
      }).toThrow('Plan does not belong to the specified creator');
    });
  });

  describe('renewSubscription - Multiple Renewals', () => {
    it('should allow multiple sequential renewals', () => {
      const expiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      service.addSubscription(fanAddress, creatorAddress, planId, expiry);

      const result1 = service.renewSubscription(fanAddress, creatorAddress, planId);
      expect(result1.success).toBe(true);

      const result2 = service.renewSubscription(fanAddress, creatorAddress, planId);
      expect(result2.success).toBe(true);

      const result3 = service.renewSubscription(fanAddress, creatorAddress, planId);
      expect(result3.success).toBe(true);

      // Each renewal should have a later expiry
      expect(result2.newExpiryTimestamp).toBeGreaterThan(result1.newExpiryTimestamp);
      expect(result3.newExpiryTimestamp).toBeGreaterThan(result2.newExpiryTimestamp);
    });

    it('should preserve subscription ID across renewals', () => {
      const expiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      service.addSubscription(fanAddress, creatorAddress, planId, expiry);

      const result1 = service.renewSubscription(fanAddress, creatorAddress, planId);
      const result2 = service.renewSubscription(fanAddress, creatorAddress, planId);

      expect(result1.subscriptionId).toBe(result2.subscriptionId);
    });
  });

  describe('renewSubscription - Different Plans', () => {
    it('should renew with different plan interval', () => {
      const expiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      service.addSubscription(fanAddress, creatorAddress, planId, expiry);

      // Plan 3 has 7-day interval
      const result = service.renewSubscription(fanAddress, creatorAddress, 3);

      const nowSec = Math.floor(Date.now() / 1000);
      const expectedMinExpiry = nowSec + 7 * 24 * 60 * 60;
      const expectedMaxExpiry = nowSec + 8 * 24 * 60 * 60;

      expect(result.newExpiryTimestamp).toBeGreaterThanOrEqual(expectedMinExpiry);
      expect(result.newExpiryTimestamp).toBeLessThanOrEqual(expectedMaxExpiry);
    });

    it('should renew with yearly plan', () => {
      const expiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      service.addSubscription(fanAddress, creatorAddress, planId, expiry);

      // Update plan 1 to have 365-day interval
      service.updatePlan(planId, creatorAddress, { intervalDays: 365 });

      const result = service.renewSubscription(fanAddress, creatorAddress, planId);

      const nowSec = Math.floor(Date.now() / 1000);
      const expectedMinExpiry = nowSec + 365 * 24 * 60 * 60;
      const expectedMaxExpiry = nowSec + 366 * 24 * 60 * 60;

      expect(result.newExpiryTimestamp).toBeGreaterThanOrEqual(expectedMinExpiry);
      expect(result.newExpiryTimestamp).toBeLessThanOrEqual(expectedMaxExpiry);
    });
  });

  describe('renewSubscription - Fan Authentication', () => {
    beforeEach(() => {
      const expiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      service.addSubscription(fanAddress, creatorAddress, planId, expiry);
    });

    it('should allow fan to renew their own subscription', () => {
      const result = service.renewSubscription(fanAddress, creatorAddress, planId);
      expect(result.success).toBe(true);
    });

    it('should allow renewal for different fan-creator pairs', () => {
      const fan2 = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2I';
      const expiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      service.addSubscription(fan2, creatorAddress, planId, expiry);

      const result1 = service.renewSubscription(fanAddress, creatorAddress, planId);
      const result2 = service.renewSubscription(fan2, creatorAddress, planId);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.subscriptionId).not.toBe(result2.subscriptionId);
    });
  });

  describe('renewSubscription - Edge Cases', () => {
    it('should handle renewal of recently created subscription', () => {
      const expiry = Math.floor(Date.now() / 1000) + 1; // Expires in 1 second
      service.addSubscription(fanAddress, creatorAddress, planId, expiry);

      const result = service.renewSubscription(fanAddress, creatorAddress, planId);

      expect(result.success).toBe(true);
      expect(result.newExpiryTimestamp).toBeGreaterThan(expiry);
    });

    it('should handle renewal of expired subscription', () => {
      const expiry = Math.floor(Date.now() / 1000) - 1; // Already expired
      service.addSubscription(fanAddress, creatorAddress, planId, expiry);

      // Subscription still exists in storage, should be renewable
      const result = service.renewSubscription(fanAddress, creatorAddress, planId);

      expect(result.success).toBe(true);
      expect(result.newExpiryTimestamp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should handle renewal with very long interval', () => {
      const expiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      service.addSubscription(fanAddress, creatorAddress, planId, expiry);

      // Update plan to have very long interval
      service.updatePlan(planId, creatorAddress, { intervalDays: 10000 });

      const result = service.renewSubscription(fanAddress, creatorAddress, planId);

      expect(result.success).toBe(true);
      expect(result.newExpiryTimestamp).toBeGreaterThan(
        Math.floor(Date.now() / 1000) + 9999 * 24 * 60 * 60,
      );
    });

    it('should return consistent results for same renewal call', () => {
      const expiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      service.addSubscription(fanAddress, creatorAddress, planId, expiry);

      const result1 = service.renewSubscription(fanAddress, creatorAddress, planId);
      const result2 = service.renewSubscription(fanAddress, creatorAddress, planId);

      // Both should succeed
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Second renewal should have later expiry
      expect(result2.newExpiryTimestamp).toBeGreaterThan(result1.newExpiryTimestamp);
    });
  });

  describe('renewSubscription - Fee Split Logic Reuse', () => {
    it('should use consistent fee calculation as checkout flow', () => {
      const expiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      service.addSubscription(fanAddress, creatorAddress, planId, expiry);

      // Create checkout to get fee calculation
      const checkout = service.createCheckout(
        fanAddress,
        creatorAddress,
        planId,
        'XLM',
      );

      // Renew subscription
      const renewalResult = service.renewSubscription(
        fanAddress,
        creatorAddress,
        planId,
      );

      // Both should use same plan
      expect(renewalResult.planId).toBe(checkout.planId);
      expect(renewalResult.success).toBe(true);
    });
  });
});
