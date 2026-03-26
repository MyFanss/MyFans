import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { User } from '../users/entities/user.entity';
import { PaginatedResponseDto } from '../common/dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Look up or create a conversation between two users with consistent ordering.
   * Ensures (min(id1, id2), max(id1, id2)) ordering to avoid duplicates.
   */
  async findOrCreateConversation(
    userId1: string,
    userId2: string,
  ): Promise<Conversation> {
    const creator = await this.userRepository.findOne({
      where: { id: userId2 },
    });
    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    const [p1, p2] =
      userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];

    let conversation = await this.conversationRepository.findOne({
      where: {
        participant_1_id: p1,
        participant_2_id: p2,
      },
      relations: ['participant_1', 'participant_2'],
    });

    if (!conversation) {
      conversation = this.conversationRepository.create({
        participant_1_id: p1,
        participant_2_id: p2,
      });
      conversation = await this.conversationRepository.save(conversation);
      // Reload to get relations
      conversation = (await this.conversationRepository.findOne({
        where: { id: conversation.id },
        relations: ['participant_1', 'participant_2'],
      }))!;
    }

    return conversation;
  }

  async getConversationById(id: string, userId: string): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (
      conversation.participant_1_id !== userId &&
      conversation.participant_2_id !== userId
    ) {
      throw new ForbiddenException(
        'User is not a participant in this conversation',
      );
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
    const savedMessage = await this.messageRepository.save(message);

    // Update conversation's updated_at to bring it to top of list
    await this.conversationRepository.update(conversationId, {
      updated_at: new Date(),
    });

    return savedMessage;
  }

  async getMessages(
    conversationId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponseDto<Message>> {
    const [messages, total] = await this.messageRepository.findAndCount({
      where: { conversation_id: conversationId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['sender'],
    });

    return new PaginatedResponseDto(
      messages.reverse(), // Return in chronological order
      total,
      page,
      limit,
    );
  }

  async markAsRead(conversationId: string, userId: string): Promise<void> {
    await this.messageRepository
      .createQueryBuilder()
      .update(Message)
      .set({ read_at: new Date() })
      .where('conversation_id = :conversationId', { conversationId })
      .andWhere('sender_id != :userId', { userId })
      .andWhere('read_at IS NULL')
      .execute();
  }

  async listConversations(
    userId: string,
    pagination: { page?: number; limit?: number } = {},
  ): Promise<PaginatedResponseDto<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [conversations, total] = await this.conversationRepository.findAndCount({
      where: [{ participant_1_id: userId }, { participant_2_id: userId }],
      relations: ['participant_1', 'participant_2'],
      order: { updated_at: 'DESC' },
      skip,
      take: limit,
    });

    const results = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await this.messageRepository.findOne({
          where: { conversation_id: conv.id },
          order: { created_at: 'DESC' },
        });

        const unreadCount = await this.messageRepository.count({
          where: {
            conversation_id: conv.id,
            sender_id:
              userId === conv.participant_1_id
                ? conv.participant_2_id
                : conv.participant_1_id,
            read_at: IsNull(),
          },
        });

        return {
          ...conv,
          lastMessage,
          unreadCount,
        };
      }),
    );

    return new PaginatedResponseDto(results, total, page, limit);
  }

  async getLastMessage(conversationId: string): Promise<Message | null> {
    return this.messageRepository.findOne({
      where: { conversation_id: conversationId },
      order: { created_at: 'DESC' },
    });
  }
}
