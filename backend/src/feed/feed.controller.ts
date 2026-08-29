import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { FeedService } from './feed.service';
import { FeedQueryDto } from './dto/feed-query.dto';
import { PaginatedResponseDto } from '../common/dto';
import { PostDto } from '../posts/dto';
import { OptionalJwtAuthGuard } from '../auth-module/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth-module/decorators/current-user.decorator';

/**
 * FeedController
 *
 * Aggregates published posts from the authenticated fan's actively
 * subscribed creators or the platform timeline into cursor-paginated feeds.
 *
 * @Controller feed
 * @version 1
 * @tags feed
 */
@ApiTags('feed')
@UseGuards(OptionalJwtAuthGuard, ThrottlerGuard)
@Controller({ path: 'feed', version: '1' })
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  @Throttle({ medium: { limit: 50, ttl: 60000 } })
  @ApiOperation({
    summary: 'Public timeline feed of published posts',
    description:
      'Cursor-paginated timeline aggregating published posts across creators. ' +
      'Gated posts return teasers with content stripped for non-subscribers.',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Opaque cursor returned as `nextCursor` on the previous page',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default 20, max 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'Cursor-paginated public feed of posts',
    type: PaginatedResponseDto<PostDto>,
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests',
    schema: { example: { statusCode: 429, message: 'Too many requests' } },
  })
  async getPublicFeed(
    @Query() query: FeedQueryDto,
    @CurrentUser() user?: { userId: string },
  ): Promise<PaginatedResponseDto<PostDto>> {
    return this.feedService.getPublicFeed(
      user?.userId,
      query.cursor,
      query.limit,
    );
  }

  @Get('subscriptions')
  @Throttle({ medium: { limit: 50, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Personalized fan feed of subscribed creators posts',
    description:
      'Cursor-paginated timeline aggregating published, non-deleted posts ' +
      'from creators the authenticated fan actively subscribes to. Returns ' +
      'an empty page when the fan has no active subscriptions or is unauthenticated.',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Opaque cursor returned as `nextCursor` on the previous page',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default 20, max 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'Cursor-paginated feed of subscribed creators posts',
    type: PaginatedResponseDto<PostDto>,
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests',
    schema: { example: { statusCode: 429, message: 'Too many requests' } },
  })
  async getSubscriptionsFeed(
    @Query() query: FeedQueryDto,
    @CurrentUser() user?: { userId: string },
  ): Promise<PaginatedResponseDto<PostDto>> {
    return this.feedService.getSubscriptionsFeed(
      user?.userId,
      query.cursor,
      query.limit,
    );
  }
}
