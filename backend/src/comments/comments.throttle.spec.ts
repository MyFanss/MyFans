import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';

// Decorator metadata lives on the unbound prototype methods, so reading it
// back is exactly what these specs are meant to do.
/* eslint-disable @typescript-eslint/unbound-method */

describe('CommentsController – rate limiting', () => {
  let controller: CommentsController;

  const mockService: jest.Mocked<
    Pick<
      CommentsService,
      'create' | 'findAll' | 'findByPost' | 'findOne' | 'update' | 'remove'
    >
  > = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPost: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'short', ttl: 60000, limit: 10 }]),
      ],
      controllers: [CommentsController],
      providers: [
        { provide: CommentsService, useValue: mockService },
        { provide: getRepositoryToken(Comment), useValue: {} },
      ],
    }).compile();

    controller = module.get(CommentsController);
  });

  afterEach(() => jest.clearAllMocks());

  it('has ThrottlerGuard applied at controller level', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      CommentsController,
    ) as unknown;
    expect(guards).toBeDefined();
    expect(guards).toContain(ThrottlerGuard);
  });

  it('create has throttle metadata', () => {
    const metadata = Reflect.getMetadata(
      'THROTTLER:LIMITshort',
      CommentsController.prototype.create,
    ) as unknown;
    expect(metadata).toBeDefined();
  });

  it('update has throttle metadata', () => {
    const metadata = Reflect.getMetadata(
      'THROTTLER:LIMITshort',
      CommentsController.prototype.update,
    ) as unknown;
    expect(metadata).toBeDefined();
  });

  it('remove has throttle metadata', () => {
    const metadata = Reflect.getMetadata(
      'THROTTLER:LIMITshort',
      CommentsController.prototype.remove,
    ) as unknown;
    expect(metadata).toBeDefined();
  });

  it('findAll does not have throttle metadata', () => {
    const metadata = Reflect.getMetadata(
      'THROTTLER:LIMITshort',
      CommentsController.prototype.findAll,
    ) as unknown;
    expect(metadata).toBeUndefined();
  });

  it('findOne does not have throttle metadata', () => {
    const metadata = Reflect.getMetadata(
      'THROTTLER:LIMITshort',
      CommentsController.prototype.findOne,
    ) as unknown;
    expect(metadata).toBeUndefined();
  });

  it('write endpoints delegate to service when within rate limit', async () => {
    mockService.create.mockResolvedValue({} as any);
    await controller.create({ content: 'Hello', postId: 'post-1' });
    expect(mockService.create).toHaveBeenCalledWith('temp-author-id', {
      content: 'Hello',
      postId: 'post-1',
    });

    mockService.update.mockResolvedValue({} as any);
    await controller.update('comment-1', { content: 'Updated' });
    expect(mockService.update).toHaveBeenCalledWith('comment-1', {
      content: 'Updated',
    });

    mockService.remove.mockResolvedValue(undefined);
    await controller.remove('comment-1');
    expect(mockService.remove).toHaveBeenCalledWith('comment-1');
  });
});
