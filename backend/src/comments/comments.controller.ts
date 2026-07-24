import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  ClassSerializerInterceptor,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseFilters,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiBody, ApiResponse, ApiTags, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CommentsService } from './comments.service';
import { CommentDto, CreateCommentDto, UpdateCommentDto } from './dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';
import { CommentsExceptionFilter } from './filters/comments-exception.filter';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { CurrentUser } from '../auth-module/decorators/current-user.decorator';

/**
 * CommentsController
 *
 * Handles CRUD operations for comments. All mutating endpoints require
 * JWT authentication (JwtAuthGuard) and use the authenticated user's ID
 * as the author for creates and as the owner for updates and deletes.
 *
 * @Controller comments
 * @version 1
 * @tags comments
 * @security BearerAuth
 */
@ApiTags('comments')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@ApiBearerAuth()
@UseFilters(new CommentsExceptionFilter())
@UseInterceptors(ClassSerializerInterceptor)
@Controller({ path: 'comments', version: '1' })
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a new comment' })
  @ApiBody({ type: CreateCommentDto })
  @ApiResponse({
    status: 201,
    description: 'Comment created successfully',
    type: CommentDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid comment parameters',
    schema: { example: { statusCode: 400, message: 'Invalid comment parameters' } },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: { example: { statusCode: 401, message: 'Unauthorized' } },
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests',
    schema: { example: { statusCode: 429, message: 'Too many requests' } },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: { example: { statusCode: 500, message: 'Internal server error' } },
  })
  async create(
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: { userId: string },
  ): Promise<CommentDto> {
    return this.commentsService.create(user.userId, dto);
  }

  /**
   * Retrieves a paginated list of all comments across all posts.
   * This endpoint is public (no JWT required).
   * Use query parameters to control pagination (page and limit).
   *
   * @param pagination - Pagination parameters (page, limit)
   * @returns Paginated response containing CommentDto array
   */
  @Get()
  @ApiOperation({
    summary: 'List all comments (paginated)',
    description:
      'Page-paginated comment list. Pass `page` and `limit`; responses include `data`, `total`, `page`, and `limit`.',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default 20, max 100)' })
  @ApiResponse({
    status: 200,
    description: 'Page-paginated comments list',
    type: PaginatedResponseDto<CommentDto>,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid pagination parameters',
    schema: { example: { statusCode: 400, message: 'Invalid pagination parameters' } },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: { example: { statusCode: 500, message: 'Internal server error' } },
  })
  async findAll(@Query() pagination: PaginationDto): Promise<PaginatedResponseDto<CommentDto>> {
    return this.commentsService.findAll(pagination);
  }

  @Get('post/:postId')
  @ApiOperation({
    summary: 'List comments by post (paginated)',
    description: 'Returns all comments for a given post, ordered by createdAt DESC.',
  })
  @ApiParam({ name: 'postId', description: 'Post ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default 20, max 100)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated post comments list',
    type: PaginatedResponseDto<CommentDto>,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid pagination parameters',
    schema: { example: { statusCode: 400, message: 'Invalid pagination parameters' } },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: { example: { statusCode: 500, message: 'Internal server error' } },
  })
  async findByPost(
    @Param('postId') postId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<CommentDto>> {
    return this.commentsService.findByPost(postId, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a comment by ID' })
  @ApiParam({ name: 'id', description: 'Comment ID' })
  @ApiResponse({ status: 200, description: 'Comment details', type: CommentDto })
  @ApiResponse({
    status: 404,
    description: 'Comment not found',
    schema: { example: { statusCode: 404, message: 'Comment with id "id" not found' } },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: { example: { statusCode: 500, message: 'Internal server error' } },
  })
  async findOne(@Param('id') id: string): Promise<CommentDto> {
    return this.commentsService.findOne(id);
  }

  @Put(':id')
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Update a comment' })
  @ApiParam({ name: 'id', description: 'Comment ID' })
  @ApiBody({ type: UpdateCommentDto })
  @ApiResponse({
    status: 200,
    description: 'Comment updated successfully',
    type: CommentDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid comment parameters',
    schema: { example: { statusCode: 400, message: 'Invalid comment parameters' } },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: { example: { statusCode: 401, message: 'Unauthorized' } },
  })
  @ApiResponse({
    status: 404,
    description: 'Comment not found',
    schema: { example: { statusCode: 404, message: 'Comment with id "id" not found' } },
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests',
    schema: { example: { statusCode: 429, message: 'Too many requests' } },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: { example: { statusCode: 500, message: 'Internal server error' } },
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: { userId: string },
  ): Promise<CommentDto> {
    return this.commentsService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiParam({ name: 'id', description: 'Comment ID' })
  @ApiResponse({ status: 204, description: 'Comment deleted successfully' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: { example: { statusCode: 401, message: 'Unauthorized' } },
  })
  @ApiResponse({
    status: 404,
    description: 'Comment not found',
    schema: { example: { statusCode: 404, message: 'Comment with id "id" not found' } },
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests',
    schema: { example: { statusCode: 429, message: 'Too many requests' } },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: { example: { statusCode: 500, message: 'Internal server error' } },
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ): Promise<void> {
    return this.commentsService.remove(id, user.userId);
  }
}
