import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PlansService } from './plans.service';

describe('PlansService', () => {
  let service: PlansService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PlansService],
    }).compile();

    service = moduleRef.get(PlansService);
  });

  const basePlan = {
    planId: 'plan-1',
    creator: 'creator-1',
    asset: 'XLM',
    amount: '10',
    interval: '30d',
  };

  describe('create', () => {
    it('returns metadata with createdAt === updatedAt and normalizes padded planId/creator', () => {
      const plan = service.create({
        ...basePlan,
        planId: '  plan-1  ',
        creator: '  creator-1  ',
      });

      expect(plan.planId).toBe('plan-1');
      expect(plan.creator).toBe('creator-1');
      expect(plan.createdAt).toBe(plan.updatedAt);
    });

    it('throws ConflictException on duplicate planId', () => {
      service.create(basePlan);

      expect(() => service.create(basePlan)).toThrow(ConflictException);
    });

    it('throws BadRequestException for an invalid asset', () => {
      expect(() => service.create({ ...basePlan, asset: 'usd' })).toThrow(BadRequestException);
    });

    it('throws BadRequestException for an invalid amount', () => {
      expect(() => service.create({ ...basePlan, amount: '1.2.3' })).toThrow(BadRequestException);
    });

    it('throws BadRequestException for an invalid interval', () => {
      expect(() => service.create({ ...basePlan, interval: '0d' })).toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('throws ForbiddenException when a different creator mutates the plan', () => {
      service.create(basePlan);

      expect(() => service.update('plan-1', { creator: 'creator-2', amount: '20' })).toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException for an unknown planId', () => {
      expect(() => service.update('missing', { creator: 'creator-1', amount: '20' })).toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('deletes the plan for the owner and findOne then throws NotFoundException', () => {
      service.create(basePlan);

      service.remove('plan-1', 'creator-1');

      expect(() => service.findOne('plan-1')).toThrow(NotFoundException);
    });
  });

  describe('listByCreator', () => {
    it('returns only that creator\'s plans sorted by planId', () => {
      service.create({ ...basePlan, planId: 'plan-c', creator: 'creator-1' });
      service.create({ ...basePlan, planId: 'plan-a', creator: 'creator-1' });
      service.create({ ...basePlan, planId: 'plan-b', creator: 'creator-1' });
      service.create({ ...basePlan, planId: 'plan-d', creator: 'creator-2' });

      const plans = service.listByCreator('creator-1');

      expect(plans.map((plan) => plan.planId)).toEqual(['plan-a', 'plan-b', 'plan-c']);
    });
  });
});
