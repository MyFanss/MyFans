import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  ClassSerializerInterceptor,
  UseFilters,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ConversationsService } from './conversations.service';
import { ConversationDto, MessageDto, CreateConversationDto, SendMessageDto } from './dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';
import { ConversationsExceptionFilter } from './filters/conversations-exception.filter';

@ApiTags('conversations')
@UseFilters(new ConversationsExceptionFilter())
@UseGuards(ThrottlerGuard)
@Controller({ path: 'conversations', version: '1' })
@UseInterceptors(ClassSerializerInterceptor)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiBody({ type: CreateConversationDto })
  @ApiResponse({ status: 201, description: 'Conversation created successfully', type: ConversationDto })
  @ApiResponse({ status: 400, description: 'Bad request – validation error' })
  @ApiResponse({ status: 429, description: 'Too many requests – rate limit exceeded' })
  async create(@Body() dto: CreateConversationDto): Promise<ConversationDto> {
    // TODO: Get user ID from auth token/session
    const userId = 'temp-user-id';
    return this.conversationsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List user conversations (paginated)' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor (last conversation ID)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of items per page (default 20)' })
  @ApiResponse({ status: 200, description: 'Paginated conversations list', type: PaginatedResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request – invalid pagination parameters' })
  async findAll(@Query() pagination: PaginationDto): Promise<PaginatedResponseDto<ConversationDto>> {
    // TODO: Get user ID from auth token/session
    const userId = 'temp-user-id';
    return this.conversationsService.findAll(userId, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a conversation by ID' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiResponse({ status: 200, description: 'Conversation details', type: ConversationDto })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async findOne(@Param('id') id: string): Promise<ConversationDto> {
    // TODO: Get user ID from auth token/session
    const userId = 'temp-user-id';
    return this.conversationsService.findOne(userId, id);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'List messages in a conversation (paginated)' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor (last message ID)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of items per page (default 20)' })
  @ApiResponse({ status: 200, description: 'Paginated messages list', type: PaginatedResponseDto })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getMessages(
    @Param('id') id: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<MessageDto>> {
    // TODO: Get user ID from auth token/session
    const userId = 'temp-user-id';
    return this.conversationsService.getMessages(userId, id, pagination);
  }

  @Post(':id/messages')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Send a message in a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({ status: 201, description: 'Message sent successfully', type: MessageDto })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 429, description: 'Too many requests – rate limit exceeded' })
  async sendMessage(@Param('id') id: string, @Body() dto: SendMessageDto): Promise<MessageDto> {
    // TODO: Get user ID from auth token/session
    const userId = 'temp-user-id';
    return this.conversationsService.sendMessage(userId, id, dto);
  }

  @Delete(':id')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiResponse({ status: 204, description: 'Conversation deleted successfully' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 429, description: 'Too many requests – rate limit exceeded' })
  async remove(@Param('id') id: string): Promise<void> {
    // TODO: Get user ID from auth token/session
    const userId = 'temp-user-id';
    return this.conversationsService.remove(userId, id);
  }
}
