import { Test, TestingModule } from '@nestjs/testing';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { PaginatedResponseDto } from '../common/dto';
import { PostDto } from '../posts/dto';

describe('FeedController', () => {
  let controller: FeedController;
  let service: { getSubscriptionsFeed: jest.Mock };
  const mockUser = { userId: 'jwt-user-1' };

  beforeEach(async () => {
    service = { getSubscriptionsFeed: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeedController],
      providers: [{ provide: FeedService, useValue: service }],
    }).compile();

    controller = module.get(FeedController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getSubscriptionsFeed', () => {
    it('passes the authenticated userId, cursor, and limit through to the service', async () => {
      const page = new PaginatedResponseDto<PostDto>([], 10, null, false);
      service.getSubscriptionsFeed.mockResolvedValue(page);

      const result = await controller.getSubscriptionsFeed(
        { cursor: 'abc', limit: 10 },
        mockUser,
      );

      expect(service.getSubscriptionsFeed).toHaveBeenCalledWith(
        'jwt-user-1',
        'abc',
        10,
      );
      expect(result).toBe(page);
    });

    it('returns an empty page when the fan has no active subscriptions', async () => {
      const emptyPage = new PaginatedResponseDto<PostDto>([], 20, null, false);
      service.getSubscriptionsFeed.mockResolvedValue(emptyPage);

      const result = await controller.getSubscriptionsFeed({}, mockUser);

      expect(result.data).toHaveLength(0);
    });
  });
});
