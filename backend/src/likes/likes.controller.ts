import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LikesService } from './likes.service';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { CurrentUser } from '../auth-module/decorators/current-user.decorator';

@ApiTags('likes')
@Controller('posts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post(':id/like')
  @ApiOperation({ summary: 'Like a post' })
  @ApiResponse({ status: 201, description: 'Like added successfully' })
  @ApiResponse({ status: 200, description: 'Post already liked (idempotent)' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - user does not have access to post',
  })
  @ApiResponse({ status: 404, description: 'Post not found' })
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
  @ApiOperation({ summary: 'Unlike a post' })
  @ApiResponse({ status: 204, description: 'Like removed successfully' })
  @ApiResponse({ status: 404, description: 'Like not found' })
  async unlikePost(
    @Param('id') postId: string,
    @CurrentUser() user: { userId: string },
  ) {
    await this.likesService.removeLike(postId, user.userId);
  }

  @Get(':id/likes/count')
  @ApiOperation({ summary: 'Get likes count for a post' })
  @ApiResponse({
    status: 200,
    description: 'Likes count',
    schema: { example: { count: 42 } },
  })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async getLikesCount(@Param('id') postId: string) {
    const count = await this.likesService.getLikesCount(postId);
    return { count };
  }

  @Get(':id/like/status')
  @ApiOperation({ summary: 'Check if current user has liked a post' })
  @ApiResponse({
    status: 200,
    description: 'Like status',
    schema: { example: { liked: true } },
  })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async getLikeStatus(
    @Param('id') postId: string,
    @CurrentUser() user: { userId: string },
  ) {
    const liked = await this.likesService.hasUserLiked(postId, user.userId);
    return { liked };
  }
}
