import { Test, TestingModule } from '@nestjs/testing';
import { ContentAccessService } from './content-access.service';
import { ContentService } from './content.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { ContentMetadata, ContentType } from './entities/content.entity';

const makeContent = (overrides: Partial<ContentMetadata> = {}): ContentMetadata =>
  ({
    id: 'uuid-1',
    creator_id: 'creator-1',
    title: 'Test Content',
    description: 'Full description',
    ipfs_cid: 'QmTest',
    ipfs_url: 'https://gateway/QmTest',
    content_type: ContentType.IMAGE,
    subscription_tier: null,
    is_published: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }) as ContentMetadata;

describe('ContentAccessService', () => {
  let service: ContentAccessService;
  let contentService: { findOne: jest.Mock };
  let subscriptionsService: { isSubscriber: jest.Mock };

  beforeEach(async () => {
    contentService = { findOne: jest.fn() };
    subscriptionsService = { isSubscriber: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentAccessService,
        { provide: ContentService, useValue: contentService },
        { provide: SubscriptionsService, useValue: subscriptionsService },
      ],
    }).compile();

    service = module.get(ContentAccessService);
  });

  afterEach(() => jest.clearAllMocks());

  it('returns full content unlocked when not gated (public)', async () => {
    contentService.findOne.mockResolvedValue(makeContent({ subscription_tier: null }));

    const result = await service.getForRequester('uuid-1');

    expect(result.locked).toBe(false);
    expect(result.ipfs_cid).toBe('QmTest');
    expect(result.description).toBe('Full description');
    expect(subscriptionsService.isSubscriber).not.toHaveBeenCalled();
  });

  it('returns full content unlocked for anonymous callers when not gated', async () => {
    contentService.findOne.mockResolvedValue(makeContent({ subscription_tier: null }));

    const result = await service.getForRequester('uuid-1', undefined);

    expect(result.locked).toBe(false);
  });

  it('returns full content unlocked for the owner even when gated', async () => {
    contentService.findOne.mockResolvedValue(makeContent({ subscription_tier: 'gold' }));

    const result = await service.getForRequester('uuid-1', 'creator-1');

    expect(result.locked).toBe(false);
    expect(result.ipfs_cid).toBe('QmTest');
    expect(subscriptionsService.isSubscriber).not.toHaveBeenCalled();
  });

  it('returns full content unlocked for an active subscriber', async () => {
    contentService.findOne.mockResolvedValue(makeContent({ subscription_tier: 'gold' }));
    subscriptionsService.isSubscriber.mockResolvedValue(true);

    const result = await service.getForRequester('uuid-1', 'fan-1');

    expect(result.locked).toBe(false);
    expect(result.ipfs_cid).toBe('QmTest');
    expect(subscriptionsService.isSubscriber).toHaveBeenCalledWith('fan-1', 'creator-1');
  });

  it('returns a teaser without sensitive fields for a non-subscriber', async () => {
    contentService.findOne.mockResolvedValue(makeContent({ subscription_tier: 'gold' }));
    subscriptionsService.isSubscriber.mockResolvedValue(false);

    const result = await service.getForRequester('uuid-1', 'fan-1');

    expect(result.locked).toBe(true);
    expect(result.ipfs_cid).toBeNull();
    expect(result.ipfs_url).toBeNull();
    expect(result.description).toBeNull();
    expect(result.title).toBe('Test Content');
    expect(result.preview_message).toBeTruthy();
  });

  it('returns a teaser for anonymous callers on gated content, without calling isSubscriber', async () => {
    contentService.findOne.mockResolvedValue(makeContent({ subscription_tier: 'gold' }));

    const result = await service.getForRequester('uuid-1');

    expect(result.locked).toBe(true);
    expect(subscriptionsService.isSubscriber).not.toHaveBeenCalled();
  });
});
