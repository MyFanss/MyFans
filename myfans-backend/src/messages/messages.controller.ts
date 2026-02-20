import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { GetMessagesQueryDto } from './dto/get-messages-query.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('conversations')
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  async createConversation(
    @CurrentUser() user: User,
    @Body() createConversationDto: CreateConversationDto,
  ) {
    const conversation = await this.messagesService.findOrCreateConversation(
      user.id,
      createConversationDto.creator_id,
    );
    const lastMessage = await this.messagesService.getLastMessage(
      conversation.id,
    );
    return {
      ...conversation,
      lastMessage,
    };
  }

  @Get()
  async listConversations(@CurrentUser() user: User) {
    return this.messagesService.listConversations(user.id);
  }

  @Get(':id/messages')
  async getMessages(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query() query: GetMessagesQueryDto,
  ) {
    // Validate participant
    await this.messagesService.getConversationById(id, user.id);

    // Mark as read when viewing messages
    await this.messagesService.markAsRead(id, user.id);

    return this.messagesService.getMessages(id, query.page, query.limit);
  }

  @Post(':id/messages')
  async sendMessage(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    // Validate participant
    await this.messagesService.getConversationById(id, user.id);

    // When sending a message, mark previous messages from the other person as read
    await this.messagesService.markAsRead(id, user.id);

    return this.messagesService.createMessage(id, user.id, sendMessageDto.body);
  }
}
