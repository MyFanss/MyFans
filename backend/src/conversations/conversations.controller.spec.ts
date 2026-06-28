import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { ConversationDto, MessageDto } from './dto';
import { PaginatedResponseDto } from '../common/dto';
import { ThrottlerModule } from '@nestjs/throttler';

const mockConversation: ConversationDto = {
  id: 'conv-1',
  participant1Id: 'temp-user-id',
  participant2Id: 'user-2',
  lastMessageId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockMessage: MessageDto = {
  id: 'msg-1',
  conversationId: 'conv-1',
  senderId: 'temp-user-id',
  content: 'Hello!',
  isRead: false,
  createdAt: new Date('2024-01-01'),
};

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
      create: jest.fn().mockResolvedValue(mockConversation),
      findAll: jest.fn().mockResolvedValue(
        new PaginatedResponseDto([mockConversation], 20, null, false),
      ),
      findOne: jest.fn().mockResolvedValue(mockConversation),
      getMessages: jest.fn().mockResolvedValue(
        new PaginatedResponseDto([mockMessage], 20, null, false),
      ),
      sendMessage: jest.fn().mockResolvedValue(mockMessage),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }])],
      controllers: [ConversationsController],
      providers: [{ provide: ConversationsService, useValue: service }],
    }).compile();

    controller = module.get(ConversationsController);
  });

  describe('create', () => {
    it('delegates to service and returns conversation dto', async () => {
      const result = await controller.create({ participant2Id: 'user-2' });

      expect(service.create).toHaveBeenCalledWith('temp-user-id', { participant2Id: 'user-2' });
      expect(result).toEqual(mockConversation);
    });
  });

  describe('findAll', () => {
    it('delegates to service with pagination and returns paginated list', async () => {
      const pagination = { limit: 10 };
      const result = await controller.findAll(pagination);

      expect(service.findAll).toHaveBeenCalledWith('temp-user-id', pagination);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(mockConversation);
    });
  });

  describe('findOne', () => {
    it('delegates to service and returns conversation dto', async () => {
      const result = await controller.findOne('conv-1');

      expect(service.findOne).toHaveBeenCalledWith('temp-user-id', 'conv-1');
      expect(result).toEqual(mockConversation);
    });

    it('propagates NotFoundException from service', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Conversation with id "missing" not found'));

      await expect(controller.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMessages', () => {
    it('delegates to service with conversation id and pagination', async () => {
      const pagination = { limit: 5 };
      const result = await controller.getMessages('conv-1', pagination);

      expect(service.getMessages).toHaveBeenCalledWith('temp-user-id', 'conv-1', pagination);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(mockMessage);
    });

    it('propagates NotFoundException when conversation does not exist', async () => {
      service.getMessages.mockRejectedValue(new NotFoundException('Conversation with id "bad" not found'));

      await expect(controller.getMessages('bad', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('sendMessage', () => {
    it('delegates to service and returns message dto', async () => {
      const result = await controller.sendMessage('conv-1', { content: 'Hello!' });

      expect(service.sendMessage).toHaveBeenCalledWith('temp-user-id', 'conv-1', { content: 'Hello!' });
      expect(result).toEqual(mockMessage);
    });

    it('propagates NotFoundException when conversation does not exist', async () => {
      service.sendMessage.mockRejectedValue(new NotFoundException('Conversation with id "bad" not found'));

      await expect(controller.sendMessage('bad', { content: 'Hi' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('delegates to service and returns void', async () => {
      const result = await controller.remove('conv-1');

      expect(service.remove).toHaveBeenCalledWith('temp-user-id', 'conv-1');
      expect(result).toBeUndefined();
    });

    it('propagates NotFoundException when conversation does not exist', async () => {
      service.remove.mockRejectedValue(new NotFoundException('Conversation with id "bad" not found'));

      await expect(controller.remove('bad')).rejects.toThrow(NotFoundException);
    });
  });
});
