import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ModerationGuard } from '../common/moderation.guard';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  // Rate limit: 10 messages per minute per user
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(ModerationGuard)
  send(@Request() req, @Body() dto: SendMessageDto) {
    return this.messagesService.send(req.user.userId, dto);
  }

  @Get('inbox')
  getInbox(@Request() req) {
    return this.messagesService.getInbox(req.user.userId);
  }

  @Get('conversation/:userId')
  getConversation(
    @Request() req,
    @Param('userId', ParseUUIDPipe) otherId: string,
  ) {
    return this.messagesService.getConversation(req.user.userId, otherId);
  }

  @Delete(':id')
  deleteMessage(
    @Request() req,
    @Param('id', ParseUUIDPipe) messageId: string,
  ) {
    return this.messagesService.deleteMessage(req.user.userId, messageId);
  }
}
