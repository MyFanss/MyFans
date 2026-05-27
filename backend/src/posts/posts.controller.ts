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
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { PostDto, CreatePostDto, UpdatePostDto } from './dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';

@ApiTags('posts')
@Controller({ path: 'posts', version: '1' })
@UseInterceptors(ClassSerializerInterceptor)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new post' })
  @ApiResponse({
    status: 201,
    description: 'Post created successfully',
    type: PostDto,
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
      'Cursor-paginated post list. Pass `cursor` and `limit`; responses include `data`, `limit`, `nextCursor`, and `hasMore`.',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Pagination cursor (`nextCursor` from the previous page)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page (default 20, max 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'Cursor-paginated posts list (`data`, `limit`, `nextCursor`, `hasMore`)',
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
      'Cursor-paginated author posts. Pass `cursor` and `limit`; responses include `data`, `limit`, `nextCursor`, and `hasMore`.',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Pagination cursor (`nextCursor` from the previous page)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page (default 20, max 100)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Cursor-paginated author posts list (`data`, `limit`, `nextCursor`, `hasMore`)',
  })
  async findByAuthor(
    @Param('authorId') authorId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<PostDto>> {
    return this.postsService.findByAuthor(authorId, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a post by ID' })
  @ApiResponse({ status: 200, description: 'Post details', type: PostDto })
  async findOne(@Param('id') id: string): Promise<PostDto> {
    return this.postsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a post' })
  @ApiResponse({
    status: 200,
    description: 'Post updated successfully',
    type: PostDto,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ): Promise<PostDto> {
    return this.postsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a post (sets deletedAt / deletedBy)' })
  @ApiResponse({ status: 204, description: 'Post soft-deleted successfully' })
  @ApiResponse({ status: 404, description: 'Post not found or already deleted' })
  async remove(
    @Param('id') id: string,
    @Query('deletedBy') deletedBy?: string,
  ): Promise<void> {
    return this.postsService.softDelete(id, deletedBy ?? 'unknown');
  }
}
