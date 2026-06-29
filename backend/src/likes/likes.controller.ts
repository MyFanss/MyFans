import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { LikesService } from './likes.service';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { CurrentUser } from '../auth-module/decorators/current-user.decorator';
import { GetLikesQueryDto } from './dto/get-likes-query.dto';

@ApiTags('likes')
@Controller({ path: 'posts', version: '1' })
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@ApiBearerAuth()
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post(':id/like')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Like a post' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({
    status: 201,
    description: 'Like added successfully',
    schema: { example: { message: 'Like added successfully', postId: 'uuid', liked: true } },
  })
  @ApiResponse({
    status: 200,
    description: 'Post already liked (idempotent)',
    schema: { example: { message: 'Post already liked', postId: 'uuid', liked: true } },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden',
    schema: { example: { statusCode: 403, message: 'Forbidden' } },
  })
  @ApiResponse({
    status: 404,
    description: 'Post not found',
    schema: { example: { statusCode: 404, message: 'Post not found' } },
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests',
    schema: { example: { statusCode: 429, message: 'Too Many Requests' } },
  })
  async likePost(
    @Param('id') postId: string,
    @CurrentUser() user: { userId: string },
  ) {
    const result = await this.likesService.addLike(postId, user.userId);
    return {
      message: result.message,
      postId,
      liked: true,
    };
  }

  @Delete(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Unlike a post' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 204, description: 'Like removed successfully' })
  @ApiResponse({
    status: 404,
    description: 'Like not found',
    schema: { example: { statusCode: 404, message: 'Like not found' } },
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests',
    schema: { example: { statusCode: 429, message: 'Too Many Requests' } },
  })
  async unlikePost(
    @Param('id') postId: string,
    @CurrentUser() user: { userId: string },
  ) {
    await this.likesService.removeLike(postId, user.userId);
  }

  @Get(':id/likes')
  @ApiOperation({ summary: 'Get paginated likes for a post' })
  @ApiResponse({ status: 200, description: 'Paginated likes list' })
  async getLikesByPost(
    @Param('id') postId: string,
    @Query() query: GetLikesQueryDto,
  ) {
    return this.likesService.getLikesByPost(postId, query.page, query.limit);
  }

  @Get(':id/likes/count')
  @ApiOperation({ summary: 'Get likes count for a post' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({
    status: 200,
    description: 'Likes count',
    schema: { example: { count: 42 } },
  })
  @ApiResponse({
    status: 404,
    description: 'Post not found',
    schema: { example: { statusCode: 404, message: 'Post not found' } },
  })
  async getLikesCount(@Param('id') postId: string) {
    const count = await this.likesService.getLikesCount(postId);
    return { count };
  }

  @Get(':id/like/status')
  @ApiOperation({ summary: 'Check if current user has liked a post' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({
    status: 200,
    description: 'Like status',
    schema: { example: { liked: true } },
  })
  @ApiResponse({
    status: 404,
    description: 'Post not found',
    schema: { example: { statusCode: 404, message: 'Post not found' } },
  })
  async getLikeStatus(
    @Param('id') postId: string,
    @CurrentUser() user: { userId: string },
  ) {
    const liked = await this.likesService.hasUserLiked(postId, user.userId);
    return { liked };
  }
}
