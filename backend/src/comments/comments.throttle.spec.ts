import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';

describe('CommentsController – rate limiting', () => {
  let controller: CommentsController;

  const mockService: jest.Mocked<
    Pick<CommentsService, 'create' | 'findAll' | 'findByPost' | 'findOne' | 'update' | 'remove'>
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
      imports: [ThrottlerModule.forRoot([{ name: 'short', ttl: 60000, limit: 10 }])],
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
    const guards = Reflect.getMetadata('__guards__', CommentsController);
    expect(guards).toBeDefined();
    expect(guards).toContain(ThrottlerGuard);
  });

  it('create has throttle metadata', () => {
    const metadata = Reflect.getMetadata(
      'THROTTLER:LIMIT',
      CommentsController.prototype.create,
    );
    expect(metadata).toBeDefined();
  });

  it('update has throttle metadata', () => {
    const metadata = Reflect.getMetadata(
      'THROTTLER:LIMIT',
      CommentsController.prototype.update,
    );
    expect(metadata).toBeDefined();
  });

  it('remove has throttle metadata', () => {
    const metadata = Reflect.getMetadata(
      'THROTTLER:LIMIT',
      CommentsController.prototype.remove,
    );
    expect(metadata).toBeDefined();
  });

  it('findAll does not have throttle metadata', () => {
    const metadata = Reflect.getMetadata(
      'THROTTLER:LIMIT',
      CommentsController.prototype.findAll,
    );
    expect(metadata).toBeUndefined();
  });

  it('findOne does not have throttle metadata', () => {
    const metadata = Reflect.getMetadata(
      'THROTTLER:LIMIT',
      CommentsController.prototype.findOne,
    );
    expect(metadata).toBeUndefined();
  });

  it('write endpoints delegate to service when within rate limit', async () => {
    mockService.create.mockResolvedValue({} as any);
    await controller.create({ content: 'Hello', postId: 'post-1' }, { userId: 'jwt-user-1' });
    expect(mockService.create).toHaveBeenCalledWith('jwt-user-1', {
      content: 'Hello',
      postId: 'post-1',
    });

    mockService.update.mockResolvedValue({} as any);
    await controller.update('comment-1', { content: 'Updated' }, { userId: 'jwt-user-1' });
    expect(mockService.update).toHaveBeenCalledWith('comment-1', { content: 'Updated' }, 'jwt-user-1');

    mockService.remove.mockResolvedValue(undefined);
    await controller.remove('comment-1', { userId: 'jwt-user-1' });
    expect(mockService.remove).toHaveBeenCalledWith('comment-1', 'jwt-user-1');
  });
});
