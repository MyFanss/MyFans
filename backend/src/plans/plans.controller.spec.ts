import { Test } from '@nestjs/testing';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { CreatePlanMetadataDto } from './dto/create-plan-metadata.dto';
import { UpdatePlanMetadataDto } from './dto/update-plan-metadata.dto';

describe('PlansController', () => {
  let controller: PlansController;
  let service: {
    create: jest.Mock;
    listByCreator: jest.Mock;
    findByPlanId: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  const metadata = {
    planId: 'plan-1',
    creator: 'creator-1',
    asset: 'XLM',
    amount: '10',
    interval: '30d',
    createdAt: 'now',
    updatedAt: 'now',
  };

  const req = { user: { id: 'creator-1' } } as any;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      listByCreator: jest.fn(),
      findByPlanId: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [PlansController],
      providers: [{ provide: PlansService, useValue: service }],
    }).compile();

    controller = moduleRef.get<PlansController>(PlansController);
  });

  describe('create', () => {
    it('delegates to plansService.create with the authenticated user id and body dto', async () => {
      const dto: CreatePlanMetadataDto = {
        planId: 'plan-1',
        asset: 'XLM',
        amount: '10',
        interval: '30d',
      } as CreatePlanMetadataDto;
      service.create.mockResolvedValue(metadata);

      const result = await controller.create(req, dto);

      expect(service.create).toHaveBeenCalledWith('creator-1', dto);
      expect(result).toBe(metadata);
    });
  });

  describe('list', () => {
    it('passes the creator query param through to plansService.listByCreator', async () => {
      service.listByCreator.mockResolvedValue([metadata]);

      const result = await controller.list('creator-1');

      expect(service.listByCreator).toHaveBeenCalledWith('creator-1');
      expect(result).toEqual([metadata]);
    });

    it('passes undefined when no creator query param is given', async () => {
      service.listByCreator.mockResolvedValue([]);

      await controller.list(undefined);

      expect(service.listByCreator).toHaveBeenCalledWith(undefined);
    });
  });

  describe('findOne', () => {
    it('delegates to plansService.findByPlanId with the planId route param', async () => {
      service.findByPlanId.mockResolvedValue(metadata);

      const result = await controller.findOne('plan-1');

      expect(service.findByPlanId).toHaveBeenCalledWith('plan-1');
      expect(result).toBe(metadata);
    });
  });

  describe('update', () => {
    it('delegates to plansService.update with user id, planId, and body dto', async () => {
      const dto: UpdatePlanMetadataDto = { amount: '20' } as UpdatePlanMetadataDto;
      service.update.mockResolvedValue({ ...metadata, amount: '20' });

      const result = await controller.update(req, 'plan-1', dto);

      expect(service.update).toHaveBeenCalledWith('creator-1', 'plan-1', dto);
      expect(result).toEqual({ ...metadata, amount: '20' });
    });
  });

  describe('remove', () => {
    it('delegates to plansService.remove with user id and planId route param', async () => {
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove(req, 'plan-1');

      expect(service.remove).toHaveBeenCalledWith('creator-1', 'plan-1');
      expect(result).toBeUndefined();
    });
  });
});
