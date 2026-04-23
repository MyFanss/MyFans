import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { ConversationDto, MessageDto, CreateConversationDto, SendMessageDto } from './dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
  ) {}

  private toConversationDto(conversation: Conversation): ConversationDto {
    return plainToInstance(ConversationDto, conversation, { excludeExtraneousValues: true });
  }

  private toMessageDto(message: Message): MessageDto {
    return plainToInstance(MessageDto, message, { excludeExtraneousValues: true });
  }

  async create(userId: string, dto: CreateConversationDto): Promise<ConversationDto> {
    const conversation = this.conversationsRepository.create({
      participant1Id: userId,
      participant2Id: dto.participant2Id,
    });
    const saved = await this.conversationsRepository.save(conversation);
    return this.toConversationDto(saved);
  }

  async findAll(userId: string, pagination: PaginationDto): Promise<PaginatedResponseDto<ConversationDto>> {
    const { cursor, limit = 20 } = pagination;

    const qb = this.conversationsRepository
      .createQueryBuilder('conversation')
      .where('conversation.participant1Id = :userId OR conversation.participant2Id = :userId', { userId })
      .orderBy('conversation.id', 'ASC')
      .take(limit + 1);

    if (cursor) {
      const cursorId = parseInt(cursor, 10);
      if (!isNaN(cursorId)) {
        qb.andWhere('conversation.id > :cursorId', { cursorId });
      }
    }

    const conversations = await qb.getMany();
    const hasMore = conversations.length > limit;
    if (hasMore) {
      conversations.pop();
    }

    let nextCursor: string | null = null;
    if (conversations.length > 0) {
      nextCursor = String(conversations[conversations.length - 1].id);
    }

    return new PaginatedResponseDto(
      conversations.map((c) => this.toConversationDto(c)),
      limit,
      nextCursor,
      hasMore,
    );
  }

  async findOne(userId: string, id: string): Promise<ConversationDto> {
    const conversation = await this.conversationsRepository.findOne({
      where: [
        { id, participant1Id: userId },
        { id, participant2Id: userId },
      ],
    });
    if (!conversation) {
      throw new NotFoundException(`Conversation with id "${id}" not found`);
    }
    return this.toConversationDto(conversation);
  }

  async getMessages(
    userId: string,
    conversationId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<MessageDto>> {
    await this.findOne(userId, conversationId);

    const { cursor, limit = 20 } = pagination;

    const qb = this.messagesRepository
      .createQueryBuilder('message')
      .where('message.conversationId = :conversationId', { conversationId })
      .orderBy('message.id', 'ASC')
      .take(limit + 1);

    if (cursor) {
      const cursorId = parseInt(cursor, 10);
      if (!isNaN(cursorId)) {
        qb.andWhere('message.id > :cursorId', { cursorId });
      }
    }

    const messages = await qb.getMany();
    const hasMore = messages.length > limit;
    if (hasMore) {
      messages.pop();
    }

    let nextCursor: string | null = null;
    if (messages.length > 0) {
      nextCursor = String(messages[messages.length - 1].id);
    }

    return new PaginatedResponseDto(
      messages.map((m) => this.toMessageDto(m)),
      limit,
      nextCursor,
      hasMore,
    );
  }

  async sendMessage(userId: string, conversationId: string, dto: SendMessageDto): Promise<MessageDto> {
    // Verify user has access to conversation
    await this.findOne(userId, conversationId);

    const message = this.messagesRepository.create({
      conversationId,
      senderId: userId,
      content: dto.content,
    });
    const saved = await this.messagesRepository.save(message);

    // Update conversation's updatedAt
    await this.conversationsRepository.update(conversationId, {
      lastMessageId: saved.id,
      updatedAt: new Date(),
    });

    return this.toMessageDto(saved);
  }

  async remove(userId: string, id: string): Promise<void> {
    const conversation = await this.findOne(userId, id);
    await this.conversationsRepository.remove(conversation as any);
  }
}
