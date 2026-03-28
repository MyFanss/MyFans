import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { EventBus } from '../events/event-bus';
import { InProcessEventBus } from '../events/in-process-event-bus';
import { SubscriptionChainReaderService } from './subscription-chain-reader.service';

describe('Subscription Plan Update', () => {
  let service: SubscriptionsService;
  let eventBus: EventBus;

  const creatorAddress = 'GAAAAAAAAAAAAAAA';
  const otherCreatorAddress = 'GBBD47ZY6F6R7OGMW5G6C5R5P6NQ5QW5R5V5S5R5O5P5Q5R5V5S5R5O5';
  const unauthorizedAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';

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

  describe('updatePlan - Creator Authorization', () => {
    it('should allow creator to update their own plan', () => {
      const planId = 1;
      const updates = { amount: '15' };

      const updatedPlan = service.updatePlan(planId, creatorAddress, updates);

      expect(updatedPlan).toBeDefined();
      expect(updatedPlan.amount).toBe('15');
      expect(updatedPlan.creator).toBe(creatorAddress);
    });

    it('should reject update from unauthorized user', () => {
      const planId = 1;
      const updates = { amount: '15' };

      expect(() => {
        service.updatePlan(planId, unauthorizedAddress, updates);
      }).toThrow('Unauthorized: Only the plan creator can update this plan');
    });

    it('should reject update from different creator', () => {
      const planId = 1; // Owned by creatorAddress
      const updates = { amount: '15' };

      expect(() => {
        service.updatePlan(planId, otherCreatorAddress, updates);
      }).toThrow('Unauthorized: Only the plan creator can update this plan');
    });

    it('should allow different creator to update their own plan', () => {
      const planId = 3; // Owned by otherCreatorAddress
      const updates = { amount: '30' };

      const updatedPlan = service.updatePlan(planId, otherCreatorAddress, updates);

      expect(updatedPlan).toBeDefined();
      expect(updatedPlan.amount).toBe('30');
      expect(updatedPlan.creator).toBe(otherCreatorAddress);
    });
  });

  describe('updatePlan - Plan Validation', () => {
    it('should throw error for non-existent plan', () => {
      const nonExistentPlanId = 9999;
      const updates = { amount: '15' };

      expect(() => {
        service.updatePlan(nonExistentPlanId, creatorAddress, updates);
      }).toThrow(NotFoundException);
      expect(() => {
        service.updatePlan(nonExistentPlanId, creatorAddress, updates);
      }).toThrow(`Plan ${nonExistentPlanId} not found`);
    });

    it('should reject negative amount', () => {
      const planId = 1;
      const updates = { amount: '-5' };

      expect(() => {
        service.updatePlan(planId, creatorAddress, updates);
      }).toThrow(BadRequestException);
      expect(() => {
        service.updatePlan(planId, creatorAddress, updates);
      }).toThrow('Amount must be a positive number');
    });

    it('should reject zero amount', () => {
      const planId = 1;
      const updates = { amount: '0' };

      expect(() => {
        service.updatePlan(planId, creatorAddress, updates);
      }).toThrow(BadRequestException);
    });

    it('should reject invalid amount format', () => {
      const planId = 1;
      const updates = { amount: 'invalid' };

      expect(() => {
        service.updatePlan(planId, creatorAddress, updates);
      }).toThrow(BadRequestException);
    });

    it('should reject negative interval days', () => {
      const planId = 1;
      const updates = { intervalDays: -7 };

      expect(() => {
        service.updatePlan(planId, creatorAddress, updates);
      }).toThrow(BadRequestException);
      expect(() => {
        service.updatePlan(planId, creatorAddress, updates);
      }).toThrow('Interval days must be a positive integer');
    });

    it('should reject zero interval days', () => {
      const planId = 1;
      const updates = { intervalDays: 0 };

      expect(() => {
        service.updatePlan(planId, creatorAddress, updates);
      }).toThrow(BadRequestException);
    });

    it('should reject non-integer interval days', () => {
      const planId = 1;
      const updates = { intervalDays: 7.5 };

      expect(() => {
        service.updatePlan(planId, creatorAddress, updates);
      }).toThrow(BadRequestException);
    });
  });

  describe('updatePlan - Update Operations', () => {
    it('should update amount only', () => {
      const planId = 1;
      const originalPlan = service.getPlan(planId);
      const updates = { amount: '20' };

      const updatedPlan = service.updatePlan(planId, creatorAddress, updates);

      expect(updatedPlan.amount).toBe('20');
      expect(updatedPlan.intervalDays).toBe(originalPlan!.intervalDays);
      expect(updatedPlan.asset).toBe(originalPlan!.asset);
    });

    it('should update interval days only', () => {
      const planId = 1;
      const originalPlan = service.getPlan(planId);
      const updates = { intervalDays: 14 };

      const updatedPlan = service.updatePlan(planId, creatorAddress, updates);

      expect(updatedPlan.intervalDays).toBe(14);
      expect(updatedPlan.amount).toBe(originalPlan!.amount);
      expect(updatedPlan.asset).toBe(originalPlan!.asset);
    });

    it('should update both amount and interval days', () => {
      const planId = 1;
      const updates = { amount: '25', intervalDays: 60 };

      const updatedPlan = service.updatePlan(planId, creatorAddress, updates);

      expect(updatedPlan.amount).toBe('25');
      expect(updatedPlan.intervalDays).toBe(60);
    });

    it('should update with decimal amount', () => {
      const planId = 1;
      const updates = { amount: '12.5' };

      const updatedPlan = service.updatePlan(planId, creatorAddress, updates);

      expect(updatedPlan.amount).toBe('12.5');
    });

    it('should update with very large amount', () => {
      const planId = 1;
      const updates = { amount: '999999.99' };

      const updatedPlan = service.updatePlan(planId, creatorAddress, updates);

      expect(updatedPlan.amount).toBe('999999.99');
    });

    it('should update with very large interval days', () => {
      const planId = 1;
      const updates = { intervalDays: 36500 }; // ~100 years

      const updatedPlan = service.updatePlan(planId, creatorAddress, updates);

      expect(updatedPlan.intervalDays).toBe(36500);
    });

    it('should set updatedAt timestamp', () => {
      const planId = 1;
      const beforeUpdate = new Date();
      const updates = { amount: '15' };

      const updatedPlan = service.updatePlan(planId, creatorAddress, updates);

      expect(updatedPlan.updatedAt).toBeDefined();
      expect(updatedPlan.updatedAt!.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });
  });

  describe('updatePlan - Existing Subscriptions Unaffected', () => {
    it('should not affect existing subscriptions when plan is updated', () => {
      const fanAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
      const planId = 1;

      // Create a subscription with original plan
      const originalPlan = service.getPlan(planId);
      const originalExpiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      service.addSubscription(fanAddress, creatorAddress, planId, originalExpiry);

      const subscriptionBefore = service.getSubscription(fanAddress, creatorAddress);

      // Update the plan
      service.updatePlan(planId, creatorAddress, { amount: '25', intervalDays: 60 });

      // Check subscription is unchanged
      const subscriptionAfter = service.getSubscription(fanAddress, creatorAddress);

      expect(subscriptionAfter).toBeDefined();
      expect(subscriptionAfter!.expiry).toBe(subscriptionBefore!.expiry);
      expect(subscriptionAfter!.planId).toBe(subscriptionBefore!.planId);
    });

    it('should not affect other subscriptions to same plan', () => {
      const fan1 = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
      const fan2 = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2I';
      const planId = 1;

      const expiry1 = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      const expiry2 = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      service.addSubscription(fan1, creatorAddress, planId, expiry1);
      service.addSubscription(fan2, creatorAddress, planId, expiry2);

      const sub1Before = service.getSubscription(fan1, creatorAddress);
      const sub2Before = service.getSubscription(fan2, creatorAddress);

      // Update the plan
      service.updatePlan(planId, creatorAddress, { amount: '30' });

      const sub1After = service.getSubscription(fan1, creatorAddress);
      const sub2After = service.getSubscription(fan2, creatorAddress);

      expect(sub1After!.expiry).toBe(sub1Before!.expiry);
      expect(sub2After!.expiry).toBe(sub2Before!.expiry);
    });
  });

  describe('getPlan', () => {
    it('should retrieve an existing plan', () => {
      const planId = 1;
      const plan = service.getPlan(planId);

      expect(plan).toBeDefined();
      expect(plan!.id).toBe(planId);
      expect(plan!.creator).toBe(creatorAddress);
    });

    it('should return undefined for non-existent plan', () => {
      const plan = service.getPlan(9999);
      expect(plan).toBeUndefined();
    });

    it('should reflect updates after plan modification', () => {
      const planId = 1;
      const updates = { amount: '50' };

      service.updatePlan(planId, creatorAddress, updates);
      const plan = service.getPlan(planId);

      expect(plan!.amount).toBe('50');
    });
  });

  describe('listCreatorPlans', () => {
    it('should list all plans for a creator', () => {
      const plans = service.listCreatorPlans(creatorAddress);

      expect(plans.length).toBeGreaterThan(0);
      expect(plans.every(p => p.creator === creatorAddress)).toBe(true);
    });

    it('should return empty array for creator with no plans', () => {
      const plans = service.listCreatorPlans(unauthorizedAddress);
      expect(plans).toEqual([]);
    });

    it('should list different plans for different creators', () => {
      const plansCreator1 = service.listCreatorPlans(creatorAddress);
      const plansCreator2 = service.listCreatorPlans(otherCreatorAddress);

      expect(plansCreator1.length).toBeGreaterThan(0);
      expect(plansCreator2.length).toBeGreaterThan(0);
      expect(plansCreator1.every(p => p.creator === creatorAddress)).toBe(true);
      expect(plansCreator2.every(p => p.creator === otherCreatorAddress)).toBe(true);
    });

    it('should reflect updates in listed plans', () => {
      const updates = { amount: '35' };
      service.updatePlan(1, creatorAddress, updates);

      const plans = service.listCreatorPlans(creatorAddress);
      const updatedPlan = plans.find(p => p.id === 1);

      expect(updatedPlan!.amount).toBe('35');
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple sequential updates', () => {
      const planId = 1;

      service.updatePlan(planId, creatorAddress, { amount: '15' });
      service.updatePlan(planId, creatorAddress, { intervalDays: 45 });
      service.updatePlan(planId, creatorAddress, { amount: '20' });

      const plan = service.getPlan(planId);

      expect(plan!.amount).toBe('20');
      expect(plan!.intervalDays).toBe(45);
    });

    it('should handle very small decimal amounts', () => {
      const planId = 1;
      const updates = { amount: '0.0001' };

      const updatedPlan = service.updatePlan(planId, creatorAddress, updates);

      expect(updatedPlan.amount).toBe('0.0001');
    });

    it('should preserve other plan properties during update', () => {
      const planId = 1;
      const originalPlan = service.getPlan(planId);
      const updates = { amount: '100' };

      const updatedPlan = service.updatePlan(planId, creatorAddress, updates);

      expect(updatedPlan.id).toBe(originalPlan!.id);
      expect(updatedPlan.creator).toBe(originalPlan!.creator);
      expect(updatedPlan.asset).toBe(originalPlan!.asset);
    });

    it('should handle empty updates object', () => {
      const planId = 1;
      const originalPlan = service.getPlan(planId);
      const updates = {};

      const updatedPlan = service.updatePlan(planId, creatorAddress, updates);

      expect(updatedPlan.amount).toBe(originalPlan!.amount);
      expect(updatedPlan.intervalDays).toBe(originalPlan!.intervalDays);
    });
  });
});
