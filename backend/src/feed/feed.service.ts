import { Injectable } from '@nestjs/common';
import { PostsService } from '../posts/posts.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PostDto } from '../posts/dto';
import { PaginatedResponseDto } from '../common/dto';

@Injectable()
export class FeedService {
  constructor(
    private readonly postsService: PostsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Aggregated timeline of published posts from creators the fan actively
   * subscribes to. Returns an empty page (not an error) when the fan has no
   * active subscriptions or is unauthenticated.
   * Premium posts return full content to subscribers and teasers to non-subscribers.
   */
  async getSubscriptionsFeed(
    fanId?: string,
    cursor?: string,
    limit = 20,
  ): Promise<PaginatedResponseDto<PostDto>> {
    if (!fanId) {
      return new PaginatedResponseDto([], limit, null, false);
    }
    const creatorIds =
      await this.subscriptionsService.getActiveCreatorIdsForFan(fanId);
    const feed = await this.postsService.findFeed(creatorIds, cursor, limit);
    return this.applyGating(feed, fanId);
  }

  /**
   * Public timeline of published posts from all creators.
   * Gated/premium posts return teasers with body stripped for non-subscribers.
   */
  async getPublicFeed(
    viewerId?: string,
    cursor?: string,
    limit = 20,
  ): Promise<PaginatedResponseDto<PostDto>> {
    const feed = await this.postsService.findPublicFeed(cursor, limit);
    return this.applyGating(feed, viewerId);
  }

  /**
   * Strips sensitive content for non-subscribers on premium posts.
   */
  private async applyGating(
    feed: PaginatedResponseDto<PostDto>,
    viewerId?: string,
  ): Promise<PaginatedResponseDto<PostDto>> {
    const gatedData = await Promise.all(
      feed.data.map(async (post) => {
        if (!post.isPremium) {
          return post;
        }
        if (viewerId && viewerId === post.authorId) {
          return post;
        }
        if (
          viewerId &&
          (await this.subscriptionsService.isSubscriber(viewerId, post.authorId))
        ) {
          return post;
        }
        return {
          ...post,
          content: '',
        };
      }),
    );

    return new PaginatedResponseDto(
      gatedData,
      feed.limit,
      feed.nextCursor,
      feed.hasMore,
    );
  }
}
