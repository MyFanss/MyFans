import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Creator } from '../creators/entities/creator.entity';
import { User } from '../users/entities/user.entity';
import { FanSummaryQueryDto } from './dto/fan-summary-query.dto';
import { Subscription, SubscriptionStatus } from './entities/subscription.entity';
import { SubscriptionsService } from './subscriptions.service';

const mockCreatorUser: Partial<User> = { id: 'creator-user-id', username: 'creator1', display_name: 'Creator One' };
const mockCreator: Partial<Creator> = { id: 'creator-id', user_id: 'creator-user-id', user: mockCreatorUser as User };
const mockFan: Partial<User> = { id: 'fan-id' };

const now = new Date();
const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

const mockSub: Partial<Subscription> = {
  id: 'sub-id',
  fan: mockFan as User,
  creator: mockCreator as Creator,
  status: SubscriptionStatus.ACTIVE,
  started_at: now,
  expires_at: expires,
  plan_id: 'plan-1',
};

const makeQb = (result: [Subscription[], number]) => ({
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue(result),
});

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let subscriptionRepo: any;
  let creatorRepo: any;

  beforeEach(async () => {
    subscriptionRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    creatorRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: getRepositoryToken(Subscription), useValue: subscriptionRepo },
        { provide: getRepositoryToken(Creator), useValue: creatorRepo },
      ],
    }).compile();

    service = module.get(SubscriptionsService);
  });

  describe('getFanSummary', () => {
    it('returns paginated active subscriptions with correct shape', async () => {
      const qb = makeQb([[mockSub as Subscription], 1]);
      subscriptionRepo.createQueryBuilder.mockReturnValue(qb);

      const query: FanSummaryQueryDto = { page: 1, limit: 20 };
      const result = await service.getFanSummary('fan-id', query);

      expect(result.total_active).toBe(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.total_pages).toBe(1);
      expect(result.items).toHaveLength(1);

      const item = result.items[0];
      expect(item.subscription_id).toBe('sub-id');
      expect(item.creator_id).toBe('creator-id');
      expect(item.creator_username).toBe('creator1');
      expect(item.creator_display_name).toBe('Creator One');
      expect(item.plan_id).toBe('plan-1');
      expect(item.started_at).toBe(now);
      expect(item.expires_at).toBe(expires);
      expect(item.renew_date).toBe(expires);
    });

    it('returns empty items when fan has no active subscriptions', async () => {
      const qb = makeQb([[], 0]);
      subscriptionRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getFanSummary('fan-id', {});

      expect(result.total_active).toBe(0);
      expect(result.items).toHaveLength(0);
      expect(result.total_pages).toBe(0);
    });

    it('applies correct pagination offsets', async () => {
      const qb = makeQb([[], 0]);
      subscriptionRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getFanSummary('fan-id', { page: 3, limit: 10 });

      expect(qb.skip).toHaveBeenCalledWith(20);
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('filters only ACTIVE subscriptions', async () => {
      const qb = makeQb([[], 0]);
      subscriptionRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getFanSummary('fan-id', {});

      expect(qb.andWhere).toHaveBeenCalledWith('sub.status = :status', {
        status: SubscriptionStatus.ACTIVE,
      });
    });

    it('calculates total_pages correctly for multi-page results', async () => {
      const qb = makeQb([Array(5).fill(mockSub) as Subscription[], 25]);
      subscriptionRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getFanSummary('fan-id', { page: 1, limit: 5 });

      expect(result.total_pages).toBe(5);
    });

    it('handles null creator user fields gracefully', async () => {
      const subWithNullUser: Partial<Subscription> = {
        ...mockSub,
        creator: { ...mockCreator, user: { username: null, display_name: null } as User } as Creator,
      };
      const qb = makeQb([[subWithNullUser as Subscription], 1]);
      subscriptionRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getFanSummary('fan-id', {});

      expect(result.items[0].creator_username).toBeNull();
      expect(result.items[0].creator_display_name).toBeNull();
    });
  });

  describe('cancel', () => {
    it('throws NotFoundException when subscription does not exist', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);
      await expect(service.cancel('no-id', 'fan-id')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not the fan', async () => {
      subscriptionRepo.findOne.mockResolvedValue({ ...mockSub, fan: { id: 'other-fan' } });
      await expect(service.cancel('sub-id', 'fan-id')).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when subscription is already cancelled', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        ...mockSub,
        fan: { id: 'fan-id' },
        status: SubscriptionStatus.CANCELLED,
      });
      await expect(service.cancel('sub-id', 'fan-id')).rejects.toThrow(ConflictException);
    });
  });
});
