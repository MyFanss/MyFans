import { Test, TestingModule } from '@nestjs/testing';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ModerationGuard } from '../common/moderation.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MessageStatus } from './entities/message.entity';

const mockMessage = {
  id: 'msg-uuid',
  senderId: 'user-1',
  recipientId: 'user-2',
  content: 'Hello!',
  status: MessageStatus.APPROVED,
  createdAt: new Date(),
};

const mockService = {
  send: jest.fn().mockResolvedValue(mockMessage),
  getInbox: jest.fn().mockResolvedValue([mockMessage]),
  getConversation: jest.fn().mockResolvedValue([mockMessage]),
  deleteMessage: jest.fn().mockResolvedValue(undefined),
};

const mockRequest = { user: { userId: 'user-1' } };

describe('MessagesController', () => {
  let controller: MessagesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [{ provide: MessagesService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(ModerationGuard).useValue({ canActivate: () => true })
      .overrideGuard(ThrottlerGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MessagesController>(MessagesController);
  });

  it('should send a message', async () => {
    const dto = { recipientId: 'user-2', content: 'Hello!' };
    const result = await controller.send(mockRequest, dto);
    expect(result).toEqual(mockMessage);
    expect(mockService.send).toHaveBeenCalledWith('user-1', dto);
  });

  it('should return inbox', async () => {
    const result = await controller.getInbox(mockRequest);
    expect(result).toEqual([mockMessage]);
  });

  it('should return conversation', async () => {
    const result = await controller.getConversation(mockRequest, 'user-2');
    expect(result).toEqual([mockMessage]);
  });

  it('should delete own message', async () => {
    await expect(controller.deleteMessage(mockRequest, 'msg-uuid')).resolves.toBeUndefined();
  });
});

describe('MessagesService unit', () => {
  it('deleteMessage throws ForbiddenException for non-owner', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({ ...mockMessage, senderId: 'other-user' }),
      remove: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const { MessagesService: Svc } = await import('./messages.service');
    const svc = new Svc(repo as any);
    await expect(svc.deleteMessage('user-1', 'msg-uuid')).rejects.toThrow(ForbiddenException);
  });

  it('deleteMessage throws NotFoundException when message missing', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
      remove: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const { MessagesService: Svc } = await import('./messages.service');
    const svc = new Svc(repo as any);
    await expect(svc.deleteMessage('user-1', 'missing-id')).rejects.toThrow(NotFoundException);
  });
});

describe('ModerationGuard', () => {
  it('blocks flagged content', () => {
    const { ModerationGuard: Guard } = require('../common/moderation.guard');
    const guard = new Guard();
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ body: { content: 'this is spam content' } }),
      }),
    } as any;
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows clean content', () => {
    const { ModerationGuard: Guard } = require('../common/moderation.guard');
    const guard = new Guard();
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ body: { content: 'Hello, how are you?' } }),
      }),
    } as any;
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
