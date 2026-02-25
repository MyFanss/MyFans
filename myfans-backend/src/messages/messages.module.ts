import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { User } from '../users/entities/user.entity';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, User]),
    AuthModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule { }
