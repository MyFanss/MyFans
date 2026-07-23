import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { NotFoundException } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import {
  ConversationDto,
  MessageDto,
  CreateConversationDto,
  SendMessageDto,
} from './dto';
import { PaginatedResponseDto } from '../common/dto';

const makeConversationDto = (
  overrides: Partial<ConversationDto> = {},
): ConversationDto => ({
  id: 'conv-1',
  participant1Id: 'temp-user-id',
  participant2Id: 'user-2',
  lastMessageId: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const makeMessageDto = (overrides: Partial<MessageDto> = {}): MessageDto => ({
  id: 'msg-1',
  conversationId: 'conv-1',
  senderId: 'temp-user-id',
  content: 'Hello!',
  isRead: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const makePaginatedConversations = (
  data: ConversationDto[],
  overrides?: Partial<PaginatedResponseDto<ConversationDto>>,
): PaginatedResponseDto<ConversationDto> => ({
  data,
  total: data.length,
  page: 1,
  limit: 20,
  totalPages: 1,
  hasMore: false,
  nextCursor: null,
  cursor: null,
  ...overrides,
});

const makePaginatedMessages = (
  data: MessageDto[],
  overrides?: Partial<PaginatedResponseDto<MessageDto>>,
): PaginatedResponseDto<MessageDto> => ({
  data,
  total: data.length,
  page: 1,
  limit: 20,
  totalPages: 1,
  hasMore: false,
  nextCursor: null,
  cursor: null,
  ...overrides,
});

describe('ConversationsController', () => {
  let controller: ConversationsController;
  let service: jest.Mocked<
    Pick<
      ConversationsService,
      | 'create'
      | 'findAll'
      | 'findOne'
      | 'getMessages'
      | 'sendMessage'
      | 'remove'
    >
  >;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      getMessages: jest.fn(),
      sendMessage: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 10 }]),
      ],
      controllers: [ConversationsController],
      providers: [{ provide: ConversationsService, useValue: service }],
    }).compile();

    controller = module.get(ConversationsController);
  });

  afterEach(() => jest.clearAllMocks());

  // ── POST /conversations ────────────────────────────────────────────────────

  describe('create', () => {
    it('calls service.create with temp userId and dto', async () => {
      const dto: CreateConversationDto = { participant2Id: 'user-2' };
      const result = makeConversationDto();
      service.create.mockResolvedValue(result);

      const actual = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith('temp-user-id', dto);
      expect(actual).toEqual(result);
    });

    it('returns created conversation with id', async () => {
      const dto: CreateConversationDto = { participant2Id: 'user-99' };
      const result = makeConversationDto({
        id: 'new-conv-id',
        participant2Id: 'user-99',
      });
      service.create.mockResolvedValue(result);

      const actual = await controller.create(dto);

      expect(actual.id).toBe('new-conv-id');
      expect(actual.participant2Id).toBe('user-99');
    });

    it('propagates service errors', async () => {
      const dto: CreateConversationDto = { participant2Id: 'user-2' };
      service.create.mockRejectedValue(new Error('DB error'));

      await expect(controller.create(dto)).rejects.toThrow('DB error');
    });
  });

  // ── GET /conversations ─────────────────────────────────────────────────────

  describe('findAll', () => {
    it('calls service.findAll with temp userId and pagination', async () => {
      const pagination = { page: 1, limit: 20 };
      const result = makePaginatedConversations([makeConversationDto()]);
      service.findAll.mockResolvedValue(result);

      await controller.findAll(pagination);

      expect(service.findAll).toHaveBeenCalledWith('temp-user-id', pagination);
    });

    it('returns paginated conversations', async () => {
      const pagination = { page: 1, limit: 20 };
      const result = makePaginatedConversations([
        makeConversationDto({ id: 'conv-1' }),
        makeConversationDto({ id: 'conv-2' }),
      ]);
      service.findAll.mockResolvedValue(result);

      const actual = await controller.findAll(pagination);

      expect(actual.data).toHaveLength(2);
    });

    it('returns empty list when user has no conversations', async () => {
      const pagination = { page: 1, limit: 20 };
      const result = makePaginatedConversations([]);
      service.findAll.mockResolvedValue(result);

      const actual = await controller.findAll(pagination);

      expect(actual.data).toHaveLength(0);
    });

    it('propagates service errors', async () => {
      const pagination = { page: 1, limit: 20 };
      service.findAll.mockRejectedValue(new Error('DB error'));

      await expect(controller.findAll(pagination)).rejects.toThrow('DB error');
    });
  });

  // ── GET /conversations/:id ─────────────────────────────────────────────────

  describe('findOne', () => {
    it('calls service.findOne with temp userId and id', async () => {
      const result = makeConversationDto();
      service.findOne.mockResolvedValue(result);

      await controller.findOne('conv-1');

      expect(service.findOne).toHaveBeenCalledWith('temp-user-id', 'conv-1');
    });

    it('returns the conversation when found', async () => {
      service.findOne.mockResolvedValue(makeConversationDto({ id: 'conv-1' }));

      const actual = await controller.findOne('conv-1');

      expect(actual.id).toBe('conv-1');
    });

    it('propagates NotFoundException when conversation not found', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('Conversation with id "missing" not found'),
      );

      await expect(controller.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('propagates service errors', async () => {
      service.findOne.mockRejectedValue(new Error('DB error'));

      await expect(controller.findOne('conv-1')).rejects.toThrow('DB error');
    });
  });

  // ── GET /conversations/:id/messages ───────────────────────────────────────

  describe('getMessages', () => {
    it('calls service.getMessages with temp userId, id, and pagination', async () => {
      const pagination = { page: 1, limit: 20 };
      const result = makePaginatedMessages([makeMessageDto()]);
      service.getMessages.mockResolvedValue(result);

      await controller.getMessages('conv-1', pagination);

      expect(service.getMessages).toHaveBeenCalledWith(
        'temp-user-id',
        'conv-1',
        pagination,
      );
    });

    it('returns paginated messages for the conversation', async () => {
      const pagination = { page: 1, limit: 20 };
      const result = makePaginatedMessages([
        makeMessageDto({ id: 'msg-1' }),
        makeMessageDto({ id: 'msg-2' }),
      ]);
      service.getMessages.mockResolvedValue(result);

      const actual = await controller.getMessages('conv-1', pagination);

      expect(actual.data).toHaveLength(2);
    });

    it('returns empty list when conversation has no messages', async () => {
      const pagination = { page: 1, limit: 20 };
      service.getMessages.mockResolvedValue(makePaginatedMessages([]));

      const actual = await controller.getMessages('conv-1', pagination);

      expect(actual.data).toHaveLength(0);
    });

    it('propagates NotFoundException when conversation not accessible', async () => {
      const pagination = { page: 1, limit: 20 };
      service.getMessages.mockRejectedValue(
        new NotFoundException('Conversation with id "other" not found'),
      );

      await expect(
        controller.getMessages('other', pagination),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── POST /conversations/:id/messages ──────────────────────────────────────

  describe('sendMessage', () => {
    it('calls service.sendMessage with temp userId, conversationId, and dto', async () => {
      const dto: SendMessageDto = { content: 'Hello!' };
      const result = makeMessageDto();
      service.sendMessage.mockResolvedValue(result);

      await controller.sendMessage('conv-1', dto);

      expect(service.sendMessage).toHaveBeenCalledWith(
        'temp-user-id',
        'conv-1',
        dto,
      );
    });

    it('returns the sent message', async () => {
      const dto: SendMessageDto = { content: 'Hello!' };
      const result = makeMessageDto({ id: 'msg-new', content: 'Hello!' });
      service.sendMessage.mockResolvedValue(result);

      const actual = await controller.sendMessage('conv-1', dto);

      expect(actual.id).toBe('msg-new');
      expect(actual.content).toBe('Hello!');
    });

    it('propagates NotFoundException when conversation not found', async () => {
      const dto: SendMessageDto = { content: 'Hi' };
      service.sendMessage.mockRejectedValue(
        new NotFoundException('Conversation with id "missing" not found'),
      );

      await expect(
        controller.sendMessage('missing', dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propagates service errors', async () => {
      const dto: SendMessageDto = { content: 'Hi' };
      service.sendMessage.mockRejectedValue(new Error('DB error'));

      await expect(controller.sendMessage('conv-1', dto)).rejects.toThrow(
        'DB error',
      );
    });
  });

  // ── DELETE /conversations/:id ──────────────────────────────────────────────

  describe('remove', () => {
    it('calls service.remove with temp userId and id', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove('conv-1');

      expect(service.remove).toHaveBeenCalledWith('temp-user-id', 'conv-1');
    });

    it('returns void on success', async () => {
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove('conv-1');

      expect(result).toBeUndefined();
    });

    it('propagates NotFoundException when conversation not found', async () => {
      service.remove.mockRejectedValue(
        new NotFoundException('Conversation with id "missing" not found'),
      );

      await expect(controller.remove('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('propagates service errors', async () => {
      service.remove.mockRejectedValue(new Error('DB error'));

      await expect(controller.remove('conv-1')).rejects.toThrow('DB error');
    });
  });
});
