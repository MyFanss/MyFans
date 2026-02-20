import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  /**
   * Look up or create a conversation between two users with consistent ordering.
   * Ensures (min(id1, id2), max(id1, id2)) ordering to avoid duplicates.
   */
  async findOrCreateConversation(
    userId1: string,
    userId2: string,
  ): Promise<Conversation> {
    const [p1, p2] = userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];

    let conversation = await this.conversationRepository.findOne({
      where: {
        participant_1_id: p1,
        participant_2_id: p2,
      },
    });

    if (!conversation) {
      conversation = this.conversationRepository.create({
        participant_1_id: p1,
        participant_2_id: p2,
      });
      conversation = await this.conversationRepository.save(conversation);
    }

    return conversation;
  }

  async createMessage(
    conversationId: string,
    senderId: string,
    body: string,
  ): Promise<Message> {
    const message = this.messageRepository.create({
      conversation_id: conversationId,
      sender_id: senderId,
      body,
    });
    return this.messageRepository.save(message);
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    return this.messageRepository.find({
      where: { conversation_id: conversationId },
      order: { created_at: 'ASC' },
    });
  }
}
