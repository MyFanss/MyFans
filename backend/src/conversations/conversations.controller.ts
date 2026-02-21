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
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiProperty } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { ConversationDto, MessageDto, CreateConversationDto, SendMessageDto } from './dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';

class PaginatedConversationsDto extends PaginatedResponseDto<ConversationDto> {
  @ApiProperty({ type: [ConversationDto] })
  data: ConversationDto[];
}

class PaginatedMessagesDto extends PaginatedResponseDto<MessageDto> {
  @ApiProperty({ type: [MessageDto] })
  data: MessageDto[];
}

@ApiTags('conversations')
@Controller('conversations')
@UseInterceptors(ClassSerializerInterceptor)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiResponse({ status: 201, description: 'Conversation created successfully', type: ConversationDto })
  async create(@Body() dto: CreateConversationDto): Promise<ConversationDto> {
    // TODO: Get user ID from auth token/session
    const userId = 'temp-user-id';
    return this.conversationsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List user conversations (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated conversations list', type: PaginatedConversationsDto })
  async findAll(@Query() pagination: PaginationDto): Promise<PaginatedResponseDto<ConversationDto>> {
    // TODO: Get user ID from auth token/session
    const userId = 'temp-user-id';
    return this.conversationsService.findAll(userId, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a conversation by ID' })
  @ApiResponse({ status: 200, description: 'Conversation details', type: ConversationDto })
  async findOne(@Param('id') id: string): Promise<ConversationDto> {
    // TODO: Get user ID from auth token/session
    const userId = 'temp-user-id';
    return this.conversationsService.findOne(userId, id);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'List messages in a conversation (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated messages list', type: PaginatedMessagesDto })
  async getMessages(
    @Param('id') id: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<MessageDto>> {
    // TODO: Get user ID from auth token/session
    const userId = 'temp-user-id';
    return this.conversationsService.getMessages(userId, id, pagination);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message in a conversation' })
  @ApiResponse({ status: 201, description: 'Message sent successfully', type: MessageDto })
  async sendMessage(@Param('id') id: string, @Body() dto: SendMessageDto): Promise<MessageDto> {
    // TODO: Get user ID from auth token/session
    const userId = 'temp-user-id';
    return this.conversationsService.sendMessage(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiResponse({ status: 204, description: 'Conversation deleted successfully' })
  async remove(@Param('id') id: string): Promise<void> {
    // TODO: Get user ID from auth token/session
    const userId = 'temp-user-id';
    return this.conversationsService.remove(userId, id);
  }
}
