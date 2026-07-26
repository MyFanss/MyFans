import { Test, TestingModule } from '@nestjs/testing';
import { FeedService } from './feed.service';
import { PostsService } from '../posts/posts.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PaginatedResponseDto } from '../common/dto';
import { PostDto } from '../posts/dto';

describe('FeedService', () => {
  let service: FeedService;
  let postsService: { findFeed: jest.Mock };
  let subscriptionsService: { getActiveCreatorIdsForFan: jest.Mock };

  beforeEach(async () => {
    postsService = { findFeed: jest.fn() };
    subscriptionsService = { getActiveCreatorIdsForFan: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedService,
        { provide: PostsService, useValue: postsService },
        { provide: SubscriptionsService, useValue: subscriptionsService },
      ],
    }).compile();

    service = module.get(FeedService);
  });

  afterEach(() => jest.clearAllMocks());

  it('resolves the active creator IDs for the fan and delegates to PostsService.findFeed', async () => {
    subscriptionsService.getActiveCreatorIdsForFan.mockResolvedValue([
      'creator-1',
      'creator-2',
    ]);
    const page = new PaginatedResponseDto<PostDto>([], 20, null, false);
    postsService.findFeed.mockResolvedValue(page);

    const result = await service.getSubscriptionsFeed('fan-1', 'cursor-1', 10);

    expect(subscriptionsService.getActiveCreatorIdsForFan).toHaveBeenCalledWith(
      'fan-1',
    );
    expect(postsService.findFeed).toHaveBeenCalledWith(
      ['creator-1', 'creator-2'],
      'cursor-1',
      10,
    );
    expect(result).toBe(page);
  });

  it('returns an empty feed (not an error) when the fan has no active subscriptions', async () => {
    subscriptionsService.getActiveCreatorIdsForFan.mockResolvedValue([]);
    const emptyPage = new PaginatedResponseDto<PostDto>([], 20, null, false);
    postsService.findFeed.mockResolvedValue(emptyPage);

    const result = await service.getSubscriptionsFeed('fan-1');

    expect(postsService.findFeed).toHaveBeenCalledWith([], undefined, 20);
    expect(result.data).toHaveLength(0);
  });

  it('defaults limit to 20 when not provided', async () => {
    subscriptionsService.getActiveCreatorIdsForFan.mockResolvedValue([
      'creator-1',
    ]);
    postsService.findFeed.mockResolvedValue(
      new PaginatedResponseDto<PostDto>([], 20, null, false),
    );

    await service.getSubscriptionsFeed('fan-1');

    expect(postsService.findFeed).toHaveBeenCalledWith(
      ['creator-1'],
      undefined,
      20,
    );
  });
});
