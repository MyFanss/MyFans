import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { ConversationDto, MessageDto, CreateConversationDto, SendMessageDto } from './dto';
import { PaginatedResponseDto } from '../common/dto';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';

const mockUser = { userId: 'jwt-user-1' };

const makeConversationDto = (overrides: Partial<ConversationDto> = {}): ConversationDto =>
  ({
    id: 'conv-1',
    participant1Id: 'jwt-user-1',
    participant2Id: 'user-2',
    lastMessageId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }) as ConversationDto;

const makeMessageDto = (overrides: Partial<MessageDto> = {}): MessageDto =>
  ({
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'jwt-user-1',
    content: 'Hello!',
    isRead: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }) as MessageDto;

const makePaginatedConversations = (
  data: ConversationDto[],
  overrides?: Partial<PaginatedResponseDto<ConversationDto>>,
): PaginatedResponseDto<ConversationDto> =>
  ({
    data,
    total: data.length,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasMore: false,
    nextCursor: null,
    cursor: null,
    ...overrides,
  }) as PaginatedResponseDto<ConversationDto>;

const makePaginatedMessages = (
  data: MessageDto[],
  overrides?: Partial<PaginatedResponseDto<MessageDto>>,
): PaginatedResponseDto<MessageDto> =>
  ({
    data,
    total: data.length,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasMore: false,
    nextCursor: null,
    cursor: null,
    ...overrides,
  }) as PaginatedResponseDto<MessageDto>;

describe('ConversationsController', () => {
  let controller: ConversationsController;
  let service: jest.Mocked<
    Pick<
      ConversationsService,
      'create' | 'findAll' | 'findOne' | 'getMessages' | 'sendMessage' | 'remove'
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
      controllers: [ConversationsController],
      providers: [
        { provide: ConversationsService, useValue: service },
        { provide: JwtAuthGuard, useValue: { canActivate: jest.fn().mockReturnValue(true) } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(ConversationsController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('calls service.create with JWT userId and dto', async () => {
      const dto: CreateConversationDto = { participant2Id: 'user-2' };
      const result = makeConversationDto();
      service.create.mockResolvedValue(result);

      const actual = await controller.create(dto, mockUser);

      expect(service.create).toHaveBeenCalledWith('jwt-user-1', dto);
      expect(actual).toEqual(result);
    });

    it('returns created conversation with id', async () => {
      const dto: CreateConversationDto = { participant2Id: 'user-99' };
      const result = makeConversationDto({ id: 'new-conv-id', participant2Id: 'user-99' });
      service.create.mockResolvedValue(result);

      const actual = await controller.create(dto, mockUser);

      expect(actual.id).toBe('new-conv-id');
      expect(actual.participant2Id).toBe('user-99');
    });

    it('propagates service errors', async () => {
      service.create.mockRejectedValue(new Error('DB error'));

      await expect(
        controller.create({} as CreateConversationDto, mockUser),
      ).rejects.toThrow('DB error');
    });
  });

  describe('findAll', () => {
    it('calls service.findAll with JWT userId and pagination', async () => {
      const pagination = { page: 1, limit: 20 };
      const expected = makePaginatedConversations([makeConversationDto()]);
      service.findAll.mockResolvedValue(expected);

      const actual = await controller.findAll(pagination, mockUser);

      expect(service.findAll).toHaveBeenCalledWith('jwt-user-1', pagination);
      expect(actual).toEqual(expected);
    });

    it('returns empty list when user has no conversations', async () => {
      const pagination = { page: 1, limit: 20 };
      service.findAll.mockResolvedValue(makePaginatedConversations([]));

      const actual = await controller.findAll(pagination, mockUser);

      expect(actual.data).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('calls service.findOne with JWT userId and conversation id', async () => {
      service.findOne.mockResolvedValue(makeConversationDto());

      await controller.findOne('conv-1', mockUser);

      expect(service.findOne).toHaveBeenCalledWith('jwt-user-1', 'conv-1');
    });

    it('returns the conversation when it exists and user is participant', async () => {
      service.findOne.mockResolvedValue(makeConversationDto({ id: 'conv-1' }));

      const result = await controller.findOne('conv-1', mockUser);

      expect(result.id).toBe('conv-1');
    });

    it('propagates NotFoundException when conversation not accessible', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('Conversation with id "other" not found'),
      );

      await expect(controller.findOne('other', mockUser)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getMessages', () => {
    it('calls service.getMessages with JWT userId, conversationId, and pagination', async () => {
      const pagination = { page: 1, limit: 20 };
      const expected = makePaginatedMessages([makeMessageDto()]);
      service.getMessages.mockResolvedValue(expected);

      const actual = await controller.getMessages('conv-1', pagination, mockUser);

      expect(service.getMessages).toHaveBeenCalledWith('jwt-user-1', 'conv-1', pagination);
      expect(actual).toEqual(expected);
    });

    it('returns empty list when conversation has no messages', async () => {
      const pagination = { page: 1, limit: 20 };
      service.getMessages.mockResolvedValue(makePaginatedMessages([]));

      const actual = await controller.getMessages('conv-1', pagination, mockUser);

      expect(actual.data).toHaveLength(0);
    });

    it('propagates NotFoundException when conversation not accessible', async () => {
      const pagination = { page: 1, limit: 20 };
      service.getMessages.mockRejectedValue(
        new NotFoundException('Conversation with id "other" not found'),
      );

      await expect(
        controller.getMessages('other', pagination, mockUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('sendMessage', () => {
    it('calls service.sendMessage with JWT userId, conversationId, and dto', async () => {
      const dto: SendMessageDto = { content: 'Hello!' };
      const result = makeMessageDto();
      service.sendMessage.mockResolvedValue(result);

      await controller.sendMessage('conv-1', dto, mockUser);

      expect(service.sendMessage).toHaveBeenCalledWith('jwt-user-1', 'conv-1', dto);
    });

    it('returns the sent message', async () => {
      const dto: SendMessageDto = { content: 'Hello!' };
      const result = makeMessageDto({ id: 'msg-new', content: 'Hello!' });
      service.sendMessage.mockResolvedValue(result);

      const actual = await controller.sendMessage('conv-1', dto, mockUser);

      expect(actual.id).toBe('msg-new');
      expect(actual.content).toBe('Hello!');
    });

    it('propagates NotFoundException when conversation not found', async () => {
      const dto: SendMessageDto = { content: 'Hi' };
      service.sendMessage.mockRejectedValue(
        new NotFoundException('Conversation with id "missing" not found'),
      );

      await expect(
        controller.sendMessage('missing', dto, mockUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propagates service errors', async () => {
      const dto: SendMessageDto = { content: 'Hi' };
      service.sendMessage.mockRejectedValue(new Error('DB error'));

      await expect(controller.sendMessage('conv-1', dto, mockUser)).rejects.toThrow('DB error');
    });
  });

  describe('remove', () => {
    it('calls service.remove with JWT userId and id', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove('conv-1', mockUser);

      expect(service.remove).toHaveBeenCalledWith('jwt-user-1', 'conv-1');
    });

    it('returns void on success', async () => {
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove('conv-1', mockUser);

      expect(result).toBeUndefined();
    });

    it('propagates NotFoundException when conversation not found', async () => {
      service.remove.mockRejectedValue(
        new NotFoundException('Conversation with id "missing" not found'),
      );

      await expect(controller.remove('missing', mockUser)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propagates service errors', async () => {
      service.remove.mockRejectedValue(new Error('DB error'));

      await expect(controller.remove('conv-1', mockUser)).rejects.toThrow('DB error');
    });
  });
});
