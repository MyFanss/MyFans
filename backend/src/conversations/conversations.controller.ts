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
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ConversationsService } from './conversations.service';
import { ConversationDto, MessageDto, CreateConversationDto, SendMessageDto } from './dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';
import { ConversationsExceptionFilter } from './filters/conversations-exception.filter';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { CurrentUser } from '../auth-module/decorators/current-user.decorator';

/**
 * ConversationsController
 *
 * Handles messaging conversations between users. All endpoints are protected
 * by JwtAuthGuard and require a valid Bearer token. The authenticated user's
 * ID from the JWT is used as the participant identifier for creates,
 * message sending, and conversation access control.
 *
 * @Controller conversations
 * @version 1
 * @tags conversations
 * @security BearerAuth
 */
@ApiTags('conversations')
@UseFilters(new ConversationsExceptionFilter())
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@ApiBearerAuth()
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
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Too many requests – rate limit exceeded' })
  async create(
    @Body() dto: CreateConversationDto,
    @CurrentUser() user: { userId: string },
  ): Promise<ConversationDto> {
    return this.conversationsService.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List user conversations (paginated)' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor (last conversation ID)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of items per page (default 20)' })
  @ApiResponse({ status: 200, description: 'Paginated conversations list', type: PaginatedResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request – invalid pagination parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Query() pagination: PaginationDto,
    @CurrentUser() user: { userId: string },
  ): Promise<PaginatedResponseDto<ConversationDto>> {
    return this.conversationsService.findAll(user.userId, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a conversation by ID' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiResponse({ status: 200, description: 'Conversation details', type: ConversationDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ): Promise<ConversationDto> {
    return this.conversationsService.findOne(user.userId, id);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'List messages in a conversation (paginated)' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor (last message ID)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of items per page (default 20)' })
  @ApiResponse({ status: 200, description: 'Paginated messages list', type: PaginatedResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getMessages(
    @Param('id') id: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: { userId: string },
  ): Promise<PaginatedResponseDto<MessageDto>> {
    return this.conversationsService.getMessages(user.userId, id, pagination);
  }

  @Post(':id/messages')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Send a message in a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({ status: 201, description: 'Message sent successfully', type: MessageDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 429, description: 'Too many requests – rate limit exceeded' })
  async sendMessage(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: { userId: string },
  ): Promise<MessageDto> {
    return this.conversationsService.sendMessage(user.userId, id, dto);
  }

  @Delete(':id')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiResponse({ status: 204, description: 'Conversation deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 429, description: 'Too many requests – rate limit exceeded' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ): Promise<void> {
    return this.conversationsService.remove(user.userId, id);
  }
}
