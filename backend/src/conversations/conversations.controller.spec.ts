import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto, SendMessageDto, ConversationDto, MessageDto } from './dto';
import { PaginatedResponseDto } from '../common/dto';

function makeConversationDto(overrides: Partial<ConversationDto> = {}): ConversationDto {
  return {
    id: 'conv-1',
    participant1Id: 'user-1',
    participant2Id: 'user-2',
    lastMessageId: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as ConversationDto;
}

function makeMessageDto(overrides: Partial<MessageDto> = {}): MessageDto {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'user-1',
    content: 'Hello!',
    isRead: false,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  } as MessageDto;
}

function makePaginatedResponse<T>(data: T[]): PaginatedResponseDto<T> {
  return new PaginatedResponseDto(data, 20, null, false);
}

describe('ConversationsController', () => {
  let controller: ConversationsController;
  let service: jest.Mocked<ConversationsService>;

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue(makeConversationDto()),
      findAll: jest.fn().mockResolvedValue(makePaginatedResponse([])),
      findOne: jest.fn().mockResolvedValue(makeConversationDto()),
      getMessages: jest.fn().mockResolvedValue(makePaginatedResponse([])),
      sendMessage: jest.fn().mockResolvedValue(makeMessageDto()),
      remove: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ConversationsService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationsController],
      providers: [{ provide: ConversationsService, useValue: service }],
    }).compile();

    controller = module.get<ConversationsController>(ConversationsController);
  });

  describe('create', () => {
    it('delegates to service.create and returns the result', async () => {
      const dto: CreateConversationDto = { participant2Id: 'user-2' };
      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith('temp-user-id', dto);
      expect(result.id).toBe('conv-1');
    });
  });

  describe('findAll', () => {
    it('delegates to service.findAll with pagination', async () => {
      const result = await controller.findAll({ limit: 10 });

      expect(service.findAll).toHaveBeenCalledWith('temp-user-id', { limit: 10 });
      expect(result).toBeInstanceOf(PaginatedResponseDto);
    });
  });

  describe('findOne', () => {
    it('delegates to service.findOne with the given id', async () => {
      const result = await controller.findOne('conv-1');

      expect(service.findOne).toHaveBeenCalledWith('temp-user-id', 'conv-1');
      expect(result.id).toBe('conv-1');
    });
  });

  describe('getMessages', () => {
    it('delegates to service.getMessages with id and pagination', async () => {
      await controller.getMessages('conv-1', { limit: 5 });

      expect(service.getMessages).toHaveBeenCalledWith('temp-user-id', 'conv-1', { limit: 5 });
    });
  });

  describe('sendMessage', () => {
    it('delegates to service.sendMessage and returns the result', async () => {
      const dto: SendMessageDto = { content: 'Hello!' };
      const result = await controller.sendMessage('conv-1', dto);

      expect(service.sendMessage).toHaveBeenCalledWith('temp-user-id', 'conv-1', dto);
      expect(result.content).toBe('Hello!');
    });
  });

  describe('remove', () => {
    it('delegates to service.remove', async () => {
      await controller.remove('conv-1');

      expect(service.remove).toHaveBeenCalledWith('temp-user-id', 'conv-1');
    });
  });
});

describe('CreateConversationDto – validation', () => {
  async function validateDto(plain: object) {
    const dto = plainToInstance(CreateConversationDto, plain);
    return validate(dto);
  }

  it('passes when participant2Id is a non-empty string', async () => {
    const errors = await validateDto({ participant2Id: 'user-abc' });
    expect(errors.filter((e) => e.property === 'participant2Id')).toHaveLength(0);
  });

  it('fails when participant2Id is missing', async () => {
    const errors = await validateDto({});
    const fieldErrors = errors.filter((e) => e.property === 'participant2Id');
    expect(fieldErrors.length).toBeGreaterThan(0);
  });

  it('fails when participant2Id is an empty string', async () => {
    const errors = await validateDto({ participant2Id: '' });
    const fieldErrors = errors.filter((e) => e.property === 'participant2Id');
    expect(fieldErrors.length).toBeGreaterThan(0);
  });

  it('fails when participant2Id is a number instead of a string', async () => {
    const errors = await validateDto({ participant2Id: 12345 });
    const fieldErrors = errors.filter((e) => e.property === 'participant2Id');
    expect(fieldErrors.length).toBeGreaterThan(0);
  });

  it('fails when participant2Id is null', async () => {
    const errors = await validateDto({ participant2Id: null });
    const fieldErrors = errors.filter((e) => e.property === 'participant2Id');
    expect(fieldErrors.length).toBeGreaterThan(0);
  });
});

describe('SendMessageDto – validation', () => {
  async function validateDto(plain: object) {
    const dto = plainToInstance(SendMessageDto, plain);
    return validate(dto);
  }

  it('passes when content is a non-empty string', async () => {
    const errors = await validateDto({ content: 'Hello world' });
    expect(errors.filter((e) => e.property === 'content')).toHaveLength(0);
  });

  it('fails when content is missing', async () => {
    const errors = await validateDto({});
    const fieldErrors = errors.filter((e) => e.property === 'content');
    expect(fieldErrors.length).toBeGreaterThan(0);
  });

  it('fails when content is an empty string', async () => {
    const errors = await validateDto({ content: '' });
    const fieldErrors = errors.filter((e) => e.property === 'content');
    expect(fieldErrors.length).toBeGreaterThan(0);
  });

  it('fails when content is a number instead of a string', async () => {
    const errors = await validateDto({ content: 42 });
    const fieldErrors = errors.filter((e) => e.property === 'content');
    expect(fieldErrors.length).toBeGreaterThan(0);
  });

  it('fails when content is null', async () => {
    const errors = await validateDto({ content: null });
    const fieldErrors = errors.filter((e) => e.property === 'content');
    expect(fieldErrors.length).toBeGreaterThan(0);
  });

  it('passes when content contains only whitespace — trimming is not enforced at DTO level', async () => {
    const errors = await validateDto({ content: '   ' });
    expect(errors.filter((e) => e.property === 'content')).toHaveLength(0);
  });
});
