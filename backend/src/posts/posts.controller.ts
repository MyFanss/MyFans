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
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags, ApiParam, ApiBody } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PostsService } from './posts.service';
import { PostDto, CreatePostDto, UpdatePostDto } from './dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';

@ApiTags('posts')
@UseGuards(ThrottlerGuard)
@UseInterceptors(ClassSerializerInterceptor)
@Controller({ path: 'posts', version: '1' })
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a new post' })
  @ApiBody({ type: CreatePostDto })
  @ApiResponse({
    status: 201,
    description: 'Post created successfully',
    type: PostDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid post parameters',
    schema: { example: { statusCode: 400, message: 'Invalid post parameters' } },
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
  async create(@Body() dto: CreatePostDto): Promise<PostDto> {
    // TODO: Get author ID from auth token/session
    const authorId = 'temp-author-id';
    return this.postsService.create(authorId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List all posts (paginated)',
    description:
      'Page-paginated post list. Pass `page` and `limit`; responses include `data`, `total`, `page`, and `limit`.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page (default 20, max 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'Page-paginated posts list',
    type: PaginatedResponseDto<PostDto>,
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
  async findAll(
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<PostDto>> {
    return this.postsService.findAll(pagination);
  }

  @Get('author/:authorId')
  @ApiOperation({
    summary: 'List posts by author (paginated)',
    description:
      'Page-paginated author posts. Pass `page` and `limit`; responses include `data`, `total`, `page`, and `limit`.',
  })
  @ApiParam({
    name: 'authorId',
    description: 'Author user ID',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page (default 20, max 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'Page-paginated author posts list',
    type: PaginatedResponseDto<PostDto>,
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
  async findByAuthor(
    @Param('authorId') authorId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<PostDto>> {
    return this.postsService.findByAuthor(authorId, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a post by ID' })
  @ApiParam({
    name: 'id',
    description: 'Post ID',
  })
  @ApiResponse({ status: 200, description: 'Post details', type: PostDto })
  @ApiResponse({
    status: 404,
    description: 'Post not found',
    schema: { example: { statusCode: 404, message: 'Post with ID {id} not found' } },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: { example: { statusCode: 500, message: 'Internal server error' } },
  })
  async findOne(@Param('id') id: string): Promise<PostDto> {
    return this.postsService.findOne(id);
  }

  @Put(':id')
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Update a post' })
  @ApiParam({
    name: 'id',
    description: 'Post ID',
  })
  @ApiBody({ type: UpdatePostDto })
  @ApiResponse({
    status: 200,
    description: 'Post updated successfully',
    type: PostDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid post parameters',
    schema: { example: { statusCode: 400, message: 'Invalid post parameters' } },
  })
  @ApiResponse({
    status: 404,
    description: 'Post not found',
    schema: { example: { statusCode: 404, message: 'Post with ID {id} not found' } },
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
    @Body() dto: UpdatePostDto,
  ): Promise<PostDto> {
    return this.postsService.update(id, dto);
  }

  @Delete(':id')
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a post (sets deletedAt / deletedBy)' })
  @ApiParam({
    name: 'id',
    description: 'Post ID',
  })
  @ApiResponse({ status: 204, description: 'Post soft-deleted successfully' })
  @ApiResponse({
    status: 404,
    description: 'Post not found or already deleted',
    schema: { example: { statusCode: 404, message: 'Post with ID {id} not found' } },
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
    @Query('deletedBy') deletedBy?: string,
  ): Promise<void> {
    return this.postsService.softDelete(id, deletedBy ?? 'unknown');
  }
}
