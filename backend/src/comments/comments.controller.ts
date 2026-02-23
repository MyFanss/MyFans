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
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CommentDto, CreateCommentDto, UpdateCommentDto } from './dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';

@ApiTags('comments')
@Controller('comments')
@UseInterceptors(ClassSerializerInterceptor)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new comment' })
  @ApiResponse({ status: 201, description: 'Comment created successfully', type: CommentDto })
  async create(@Body() dto: CreateCommentDto): Promise<CommentDto> {
    // TODO: Get author ID from auth token/session
    const authorId = 'temp-author-id';
    return this.commentsService.create(authorId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all comments (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated comments list' })
  async findAll(@Query() pagination: PaginationDto): Promise<PaginatedResponseDto<CommentDto>> {
    return this.commentsService.findAll(pagination);
  }

  @Get('post/:postId')
  @ApiOperation({ summary: 'List comments by post (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated post comments list' })
  async findByPost(
    @Param('postId') postId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<CommentDto>> {
    return this.commentsService.findByPost(postId, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a comment by ID' })
  @ApiResponse({ status: 200, description: 'Comment details', type: CommentDto })
  async findOne(@Param('id') id: string): Promise<CommentDto> {
    return this.commentsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a comment' })
  @ApiResponse({ status: 200, description: 'Comment updated successfully', type: CommentDto })
  async update(@Param('id') id: string, @Body() dto: UpdateCommentDto): Promise<CommentDto> {
    return this.commentsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiResponse({ status: 204, description: 'Comment deleted successfully' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.commentsService.remove(id);
  }
}
