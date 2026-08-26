import { Injectable } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentMetadata } from './entities/content.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

export type GatedContentView = Omit<
  Partial<ContentMetadata>,
  'ipfs_cid' | 'ipfs_url'
> & {
  ipfs_cid?: string | null;
  ipfs_url?: string | null;
  locked: boolean;
  preview_message?: string;
};

/**
 * Resolves what a given requester is allowed to see for a content item.
 *
 * Gating is keyed on `subscription_tier`: content without a tier is public.
 * Gated content is fully visible to its owner and to active subscribers;
 * everyone else gets a teaser with the sensitive fields (description, IPFS
 * pointers) stripped.
 *
 * NOTE: the subscriber check reuses `SubscriptionsService#isSubscriber`,
 * which is keyed on Stellar addresses in the on-chain subscription flow.
 * Until platform user IDs are bridged to wallet addresses (see the caveat
 * documented on `HybridFanAuthGuard`), this treats `requesterId` /
 * `creator_id` as opaque identity strings — the subscriber check only
 * resolves correctly once the caller's identity matches how the
 * subscription was indexed.
 */
@Injectable()
export class ContentAccessService {
  constructor(
    private readonly contentService: ContentService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async getForRequester(
    id: string,
    requesterId?: string,
  ): Promise<GatedContentView> {
    const content = await this.contentService.findOne(id);

    if (!content.subscription_tier) {
      return { ...content, locked: false };
    }

    if (requesterId && requesterId === content.creator_id) {
      return { ...content, locked: false };
    }

    const isSubscriber = requesterId
      ? await this.subscriptionsService.isSubscriber(
          requesterId,
          content.creator_id,
        )
      : false;

    if (isSubscriber) {
      return { ...content, locked: false };
    }

    return this.buildTeaser(content);
  }

  private buildTeaser(content: ContentMetadata): GatedContentView {
    return {
      id: content.id,
      creator_id: content.creator_id,
      title: content.title,
      description: null,
      ipfs_cid: null,
      ipfs_url: null,
      content_type: content.content_type,
      subscription_tier: content.subscription_tier,
      is_published: content.is_published,
      created_at: content.created_at,
      updated_at: content.updated_at,
      locked: true,
      preview_message: 'Subscribe to this creator to unlock the full content.',
    };
  }
}
