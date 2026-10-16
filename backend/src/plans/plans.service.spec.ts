import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PlansService } from './plans.service';

describe('PlansService', () => {
  let service: PlansService;
  let repo: { findById: jest.Mock; findAll: jest.Mock };

  const knownPlan = {
    id: 'creator-monthly',
    name: 'Creator Monthly',
    price: 999,
    features: ['analytics', 'scheduling'],
  };

  beforeEach(async () => {
    repo = {
      findById: jest.fn(),
      findAll: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PlansService,
        { provide: 'PlansRepository', useValue: repo },
      ],
    }).compile();

    service = moduleRef.get<PlansService>(PlansService);
  });

  it('returns the expected plan for a known plan id', async () => {
    repo.findById.mockResolvedValue(knownPlan);

    const result = await service.findById(knownPlan.id);

    expect(repo.findById).toHaveBeenCalledWith(knownPlan.id);
    expect(result).toEqual(knownPlan);
  });

  it('throws NotFoundException for an unknown plan id', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(service.findById('does-not-exist')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('does not mutate the plan object it is given', async () => {
    const input = { ...knownPlan, features: [...knownPlan.features] };
    const snapshot = JSON.parse(JSON.stringify(input));
    repo.findById.mockResolvedValue(input);

    await service.findById(input.id);

    expect(input).toEqual(snapshot);
  });
});
