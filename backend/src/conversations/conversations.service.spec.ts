import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    participant1Id: 'user-1',
    participant2Id: 'user-2',
    lastMessageId: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'user-1',
    content: 'Hello!',
    isRead: false,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function makeQb(results: any[]) {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(results),
  };
  return qb;
}

describe('ConversationsService', () => {
  let service: ConversationsService;
  let conversationsRepo: jest.Mocked<any>;
  let messagesRepo: jest.Mocked<any>;

  beforeEach(async () => {
    conversationsRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      remove: jest.fn().mockResolvedValue({}),
      createQueryBuilder: jest.fn(),
    };

    messagesRepo = {
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: getRepositoryToken(Conversation), useValue: conversationsRepo },
        { provide: getRepositoryToken(Message), useValue: messagesRepo },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
  });

  describe('happy path', () => {
    const userId = 'user-1';
    const otherUserId = 'user-2';

    describe('create', () => {
      it('creates and returns a ConversationDto', async () => {
        const conv = makeConversation();
        conversationsRepo.create.mockReturnValue(conv);
        conversationsRepo.save.mockResolvedValue(conv);

        const result = await service.create(userId, { participant2Id: otherUserId });

        expect(conversationsRepo.create).toHaveBeenCalledWith({
          participant1Id: userId,
          participant2Id: otherUserId,
        });
        expect(conversationsRepo.save).toHaveBeenCalledWith(conv);
        expect(result.id).toBe('conv-1');
        expect(result.participant1Id).toBe(userId);
        expect(result.participant2Id).toBe(otherUserId);
      });
    });

    describe('findAll', () => {
      it('returns conversations where user is participant1 or participant2', async () => {
        const convs = [makeConversation(), makeConversation({ id: 'conv-2', participant1Id: 'user-3', participant2Id: userId })];
        conversationsRepo.createQueryBuilder.mockReturnValue(makeQb(convs));

        const result = await service.findAll(userId, { limit: 20 });

        expect(result.data).toHaveLength(2);
        expect(result.hasMore).toBe(false);
      });

      it('returns empty list when user has no conversations', async () => {
        conversationsRepo.createQueryBuilder.mockReturnValue(makeQb([]));

        const result = await service.findAll(userId, { limit: 20 });

        expect(result.data).toHaveLength(0);
        expect(result.hasMore).toBe(false);
        expect(result.nextCursor).toBeNull();
      });

      it('returns nextCursor pointing to the last item id', async () => {
        const convs = [makeConversation({ id: 'conv-a' }), makeConversation({ id: 'conv-b' })];
        conversationsRepo.createQueryBuilder.mockReturnValue(makeQb(convs));

        const result = await service.findAll(userId, { limit: 20 });

        expect(result.nextCursor).toBe('conv-b');
      });
    });

    describe('findOne', () => {
      it('returns ConversationDto when user is a participant', async () => {
        const conv = makeConversation();
        conversationsRepo.findOne.mockResolvedValue(conv);

        const result = await service.findOne(userId, 'conv-1');

        expect(result.id).toBe('conv-1');
        expect(result.participant1Id).toBe(userId);
      });

      it('throws NotFoundException when conversation does not exist', async () => {
        conversationsRepo.findOne.mockResolvedValue(null);

        await expect(service.findOne(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
      });

      it('throws NotFoundException when user is not a participant', async () => {
        conversationsRepo.findOne.mockResolvedValue(null);

        await expect(service.findOne('stranger', 'conv-1')).rejects.toThrow(NotFoundException);
      });
    });

    describe('getMessages', () => {
      it('returns paginated messages for a conversation', async () => {
        conversationsRepo.findOne.mockResolvedValue(makeConversation());
        const msgs = [makeMessage({ id: 'msg-1' }), makeMessage({ id: 'msg-2' })];
        messagesRepo.createQueryBuilder.mockReturnValue(makeQb(msgs));

        const result = await service.getMessages(userId, 'conv-1', { limit: 20 });

        expect(result.data).toHaveLength(2);
        expect(result.hasMore).toBe(false);
        expect(result.nextCursor).toBe('msg-2');
      });

      it('throws NotFoundException when conversation not found', async () => {
        conversationsRepo.findOne.mockResolvedValue(null);

        await expect(service.getMessages(userId, 'nonexistent', { limit: 20 })).rejects.toThrow(NotFoundException);
      });

      it('returns empty messages list for a new conversation', async () => {
        conversationsRepo.findOne.mockResolvedValue(makeConversation());
        messagesRepo.createQueryBuilder.mockReturnValue(makeQb([]));

        const result = await service.getMessages(userId, 'conv-1', { limit: 20 });

        expect(result.data).toHaveLength(0);
        expect(result.nextCursor).toBeNull();
      });
    });

    describe('sendMessage', () => {
      it('creates a message and updates lastMessageId on conversation', async () => {
        conversationsRepo.findOne.mockResolvedValue(makeConversation());
        const msg = makeMessage();
        messagesRepo.create.mockReturnValue(msg);
        messagesRepo.save.mockResolvedValue(msg);

        const result = await service.sendMessage(userId, 'conv-1', { content: 'Hello!' });

        expect(messagesRepo.create).toHaveBeenCalledWith({
          conversationId: 'conv-1',
          senderId: userId,
          content: 'Hello!',
        });
        expect(conversationsRepo.update).toHaveBeenCalledWith(
          'conv-1',
          expect.objectContaining({ lastMessageId: 'msg-1' }),
        );
        expect(result.content).toBe('Hello!');
        expect(result.senderId).toBe(userId);
        expect(result.conversationId).toBe('conv-1');
      });

      it('throws NotFoundException when conversation not found', async () => {
        conversationsRepo.findOne.mockResolvedValue(null);

        await expect(service.sendMessage(userId, 'nonexistent', { content: 'Hi' })).rejects.toThrow(NotFoundException);
      });
    });

    describe('remove', () => {
      it('removes a conversation the user participates in', async () => {
        const conv = makeConversation();
        conversationsRepo.findOne.mockResolvedValue(conv);

        await service.remove(userId, 'conv-1');

        expect(conversationsRepo.remove).toHaveBeenCalled();
      });

      it('throws NotFoundException when conversation does not exist', async () => {
        conversationsRepo.findOne.mockResolvedValue(null);

        await expect(service.remove(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('pagination', () => {
    const userId = 'user-1';

    it('respects the limit parameter', async () => {
      const convs = Array.from({ length: 6 }, (_, i) => makeConversation({ id: `conv-${i + 1}` }));
      conversationsRepo.createQueryBuilder.mockReturnValue(makeQb(convs));

      const result = await service.findAll(userId, { limit: 5 });

      expect(result.data).toHaveLength(5);
      expect(result.limit).toBe(5);
      expect(result.hasMore).toBe(true);
    });

    it('sets hasMore=false when total results fit within limit', async () => {
      const convs = [makeConversation({ id: 'conv-1' }), makeConversation({ id: 'conv-2' })];
      conversationsRepo.createQueryBuilder.mockReturnValue(makeQb(convs));

      const result = await service.findAll(userId, { limit: 5 });

      expect(result.hasMore).toBe(false);
    });

    it('applies numeric cursor as andWhere condition', async () => {
      const qb = makeQb([]);
      conversationsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(userId, { cursor: '10', limit: 20 });

      expect(qb.andWhere).toHaveBeenCalledWith('conversation.id > :cursorId', { cursorId: 10 });
    });

    it('ignores non-numeric cursor and does not apply andWhere', async () => {
      const qb = makeQb([]);
      conversationsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(userId, { cursor: 'not-a-number', limit: 20 });

      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('handles stale cursor returning zero results without crashing', async () => {
      conversationsRepo.createQueryBuilder.mockReturnValue(makeQb([]));

      const result = await service.findAll(userId, { cursor: '99999', limit: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('defaults limit to 20 when not provided', async () => {
      const qb = makeQb([]);
      conversationsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(userId, {});

      expect(qb.take).toHaveBeenCalledWith(21);
    });

    it('messages pagination respects limit and returns hasMore', async () => {
      conversationsRepo.findOne.mockResolvedValue(makeConversation());
      const msgs = Array.from({ length: 4 }, (_, i) => makeMessage({ id: `msg-${i + 1}` }));
      messagesRepo.createQueryBuilder.mockReturnValue(makeQb(msgs));

      const result = await service.getMessages(userId, 'conv-1', { limit: 3 });

      expect(result.data).toHaveLength(3);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('msg-3');
    });

    it('messages pagination applies numeric cursor', async () => {
      conversationsRepo.findOne.mockResolvedValue(makeConversation());
      const qb = makeQb([]);
      messagesRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getMessages(userId, 'conv-1', { cursor: '5', limit: 20 });

      expect(qb.andWhere).toHaveBeenCalledWith('message.id > :cursorId', { cursorId: 5 });
    });
  });
});
