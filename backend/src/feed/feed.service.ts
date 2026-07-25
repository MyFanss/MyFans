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
   * active subscriptions.
   */
  async getSubscriptionsFeed(
    fanId: string,
    cursor?: string,
    limit = 20,
  ): Promise<PaginatedResponseDto<PostDto>> {
    const creatorIds =
      await this.subscriptionsService.getActiveCreatorIdsForFan(fanId);
    return this.postsService.findFeed(creatorIds, cursor, limit);
  }
}
