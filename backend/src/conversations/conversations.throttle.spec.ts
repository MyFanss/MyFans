import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

// Decorator metadata lives on the unbound prototype methods, so reading it
// back is exactly what these specs are meant to do.
/* eslint-disable @typescript-eslint/unbound-method */

describe('ConversationsController – rate limiting', () => {
  let controller: ConversationsController;

  const mockService = {
    create: jest.fn().mockResolvedValue({ id: 'conv-1' }),
    findAll: jest.fn().mockResolvedValue({ data: [], hasMore: false }),
    findOne: jest.fn().mockResolvedValue({ id: 'conv-1' }),
    getMessages: jest.fn().mockResolvedValue({ data: [], hasMore: false }),
    sendMessage: jest.fn().mockResolvedValue({ id: 'msg-1' }),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }]),
      ],
      controllers: [ConversationsController],
      providers: [{ provide: ConversationsService, useValue: mockService }],
    }).compile();

    controller = module.get(ConversationsController);
  });

  it('should have ThrottlerGuard applied at controller level', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      ConversationsController,
    ) as unknown;
    expect(guards).toBeDefined();
    expect(guards).toContain(ThrottlerGuard);
  });

  it('should have throttle metadata on create', () => {
    const metadata = Reflect.getMetadata(
      'THROTTLER:LIMITdefault',
      ConversationsController.prototype.create,
    ) as unknown;
    expect(metadata).toBeDefined();
  });

  it('should have throttle metadata on sendMessage', () => {
    const metadata = Reflect.getMetadata(
      'THROTTLER:LIMITdefault',
      ConversationsController.prototype.sendMessage,
    ) as unknown;
    expect(metadata).toBeDefined();
  });

  it('should have throttle metadata on remove', () => {
    const metadata = Reflect.getMetadata(
      'THROTTLER:LIMITdefault',
      ConversationsController.prototype.remove,
    ) as unknown;
    expect(metadata).toBeDefined();
  });

  it('read endpoints do not have explicit throttle overrides', () => {
    for (const method of ['findAll', 'findOne', 'getMessages'] as const) {
      const metadata = Reflect.getMetadata(
        'THROTTLER:LIMITdefault',
        ConversationsController.prototype[method],
      ) as unknown;
      expect(metadata).toBeUndefined();
    }
  });

  it('write endpoints still delegate to service when within rate limit', async () => {
    await controller.create({ participant2Id: 'user-2' }, { userId: 'jwt-user-1' });
    expect(mockService.create).toHaveBeenCalled();

    await controller.sendMessage('conv-1', { content: 'hi' }, { userId: 'jwt-user-1' });
    expect(mockService.sendMessage).toHaveBeenCalled();

    await controller.remove('conv-1', { userId: 'jwt-user-1' });
    expect(mockService.remove).toHaveBeenCalled();
  });
});
