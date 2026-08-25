import { Injectable } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentMetadata } from './entities/content.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { WalletLinksService } from '../wallet-links/wallet-links.service';

export type GatedContentView = Omit<
  Partial<ContentMetadata>,
  'description' | 'ipfs_cid' | 'ipfs_url'
> & {
  description?: string | null;
  ipfs_cid?: string | null;
  ipfs_url?: string | null;
  locked: boolean;
  preview_message?: string;
};

/** Identity of the caller requesting content, resolved by whichever guard ran. */
export interface ContentRequester {
  /** Platform user UUID, set when the caller authenticated via JWT. */
  userId?: string;
  /** Stellar G-address, set when the caller authenticated via Stellar bearer. */
  fanAddress?: string;
}

/**
 * Resolves what a given requester is allowed to see for a content item.
 *
 * Gating is keyed on `subscription_tier`: content without a tier is public.
 * Gated content is fully visible to its owner and to active subscribers;
 * everyone else gets a teaser with the sensitive fields (description, IPFS
 * pointers) stripped.
 *
 * The subscription index (`SubscriptionsService#isSubscriber`) is keyed on
 * Stellar addresses, not platform user UUIDs (see #1561). A JWT-authenticated
 * caller is therefore resolved to their linked Stellar wallet address (via
 * `WalletLinksService`) before the subscriber check; a Stellar-bearer caller
 * (see `HybridFanAuthGuard`, #1562) already carries a Stellar address and is
 * used as-is. A UUID is never compared directly against a G-address.
 */
@Injectable()
export class ContentAccessService {
  constructor(
    private readonly contentService: ContentService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly walletLinksService: WalletLinksService,
  ) {}

  async getForRequester(
    id: string,
    requester?: ContentRequester,
  ): Promise<GatedContentView> {
    const content = await this.contentService.findOne(id);

    if (!content.subscription_tier) {
      return { ...content, locked: false };
    }

    if (requester?.userId && requester.userId === content.creator_id) {
      return { ...content, locked: false };
    }

    const fanAddress = await this.resolveFanAddress(requester);

    const isSubscriber = fanAddress
      ? await this.subscriptionsService.isSubscriber(
          fanAddress,
          content.creator_id,
        )
      : false;

    if (isSubscriber) {
      return { ...content, locked: false };
    }

    return this.buildTeaser(content);
  }

  /**
   * Resolves the requester onto a single Stellar address, or `null` if none
   * can be determined (anonymous caller, or a JWT-authenticated user with no
   * linked wallet). A `fanAddress` supplied directly (Stellar bearer auth)
   * always wins; a `userId` (JWT auth) is looked up in the wallet-link table.
   */
  private async resolveFanAddress(
    requester?: ContentRequester,
  ): Promise<string | null> {
    if (!requester) return null;
    if (requester.fanAddress) return requester.fanAddress;
    if (requester.userId) {
      return this.walletLinksService.getPrimaryAddress(requester.userId);
    }
    return null;
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
