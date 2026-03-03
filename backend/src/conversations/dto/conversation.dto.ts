import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ConversationDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  participant1Id: string;

  @ApiProperty()
  @Expose()
  participant2Id: string;

  @ApiPropertyOptional()
  @Expose()
  lastMessageId: string | null;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;
}

export class MessageDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  conversationId: string;

  @ApiProperty()
  @Expose()
  senderId: string;

  @ApiProperty()
  @Expose()
  content: string;

  @ApiProperty()
  @Expose()
  isRead: boolean;

  @ApiProperty()
  @Expose()
  createdAt: Date;
}

export class CreateConversationDto {
  @ApiProperty()
  participant2Id: string;
}

export class SendMessageDto {
  @ApiProperty()
  content: string;
}
