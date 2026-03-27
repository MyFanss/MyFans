import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message, MessageStatus } from './entities/message.entity';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
  ) {}

  async send(senderId: string, dto: SendMessageDto): Promise<Message> {
    const message = this.messageRepo.create({
      senderId,
      recipientId: dto.recipientId,
      content: dto.content,
      status: MessageStatus.APPROVED, // set PENDING if async moderation is needed
    });
    return this.messageRepo.save(message);
  }

  async getConversation(userId: string, otherId: string): Promise<Message[]> {
    return this.messageRepo.find({
      where: [
        { senderId: userId, recipientId: otherId, status: MessageStatus.APPROVED },
        { senderId: otherId, recipientId: userId, status: MessageStatus.APPROVED },
      ],
      order: { createdAt: 'ASC' },
    });
  }

  async getInbox(userId: string): Promise<Message[]> {
    return this.messageRepo.find({
      where: { recipientId: userId, status: MessageStatus.APPROVED },
      order: { createdAt: 'DESC' },
    });
  }

  async deleteMessage(userId: string, messageId: string): Promise<void> {
    const message = await this.messageRepo.findOne({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) throw new ForbiddenException('Not your message');
    await this.messageRepo.remove(message);
  }
}
