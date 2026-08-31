import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { CommentDto, CreateCommentDto, UpdateCommentDto } from './dto';
import { PaginatedResponseDto } from '../common/dto';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';

const mockUser = { userId: 'jwt-user-1' };

const makeDto = (overrides: Partial<CommentDto> = {}): CommentDto =>
  ({
    id: 'comment-1',
    content: 'Great post!',
    authorId: 'jwt-user-1',
    postId: '00000000-0000-4000-8000-000000000001',
    parentId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }) as CommentDto;

const makePaginatedResponse = (
  data: CommentDto[],
  overrides?: Partial<PaginatedResponseDto<CommentDto>>,
): PaginatedResponseDto<CommentDto> =>
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
  }) as PaginatedResponseDto<CommentDto>;

describe('CommentsController', () => {
  let controller: CommentsController;
  let service: jest.Mocked<
    Pick<
      CommentsService,
      'create' | 'findAll' | 'findByPost' | 'findOne' | 'update' | 'remove'
    >
  >;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findByPost: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }]),
      ],
      controllers: [CommentsController],
      providers: [
        { provide: CommentsService, useValue: service },
        { provide: JwtAuthGuard, useValue: { canActivate: jest.fn().mockReturnValue(true) } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(CommentsController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('calls service.create with JWT userId and dto', async () => {
      const dto: CreateCommentDto = {
        content: 'Great post!',
        postId: '00000000-0000-4000-8000-000000000001',
      };
      const result = makeDto();
      service.create.mockResolvedValue(result);

      const actual = await controller.create(dto, mockUser);

      expect(service.create).toHaveBeenCalledWith('jwt-user-1', dto);
      expect(actual).toEqual(result);
    });

    it('returns the created CommentDto with an id', async () => {
      const dto: CreateCommentDto = {
        content: 'Hello',
        postId: '00000000-0000-4000-8000-000000000001',
      };
      const result = makeDto({ id: 'new-comment-id', content: 'Hello' });
      service.create.mockResolvedValue(result);

      const actual = await controller.create(dto, mockUser);

      expect(actual.id).toBe('new-comment-id');
      expect(actual.content).toBe('Hello');
    });

    it('passes optional parentId through to the service', async () => {
      const parentId = '00000000-0000-4000-8000-000000000002';
      const dto: CreateCommentDto = {
        content: 'Reply',
        postId: '00000000-0000-4000-8000-000000000001',
        parentId,
      };
      const result = makeDto({ parentId });
      service.create.mockResolvedValue(result);

      const actual = await controller.create(dto, mockUser);

      expect(service.create).toHaveBeenCalledWith(
        'jwt-user-1',
        expect.objectContaining({ parentId }),
      );
      expect(actual.parentId).toBe(parentId);
    });

    it('propagates service errors', async () => {
      service.create.mockRejectedValue(new Error('DB error'));

      await expect(
        controller.create({} as CreateCommentDto, mockUser),
      ).rejects.toThrow('DB error');
    });
  });

  describe('findAll', () => {
    it('calls service.findAll with pagination', async () => {
      const pagination = { page: 1, limit: 20 };
      const expected = makePaginatedResponse([makeDto()]);
      service.findAll.mockResolvedValue(expected);

      const actual = await controller.findAll(pagination);

      expect(service.findAll).toHaveBeenCalledWith(pagination);
      expect(actual).toEqual(expected);
    });

    it('returns empty list when no comments exist', async () => {
      service.findAll.mockResolvedValue(makePaginatedResponse([]));

      const result = await controller.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(0);
    });
  });

  describe('findByPost', () => {
    it('calls service.findByPost with postId and pagination', async () => {
      const pagination = { page: 1, limit: 20 };
      const expected = makePaginatedResponse([makeDto()]);
      service.findByPost.mockResolvedValue(expected);

      const actual = await controller.findByPost('post-123', pagination);

      expect(service.findByPost).toHaveBeenCalledWith('post-123', pagination);
      expect(actual).toBe(expected);
    });

    it('returns empty list when post has no comments', async () => {
      service.findByPost.mockResolvedValue(makePaginatedResponse([]));

      const result = await controller.findByPost('post-123', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('calls service.findOne with the id', async () => {
      service.findOne.mockResolvedValue(makeDto());

      await controller.findOne('comment-1');

      expect(service.findOne).toHaveBeenCalledWith('comment-1');
    });

    it('returns the comment when it exists', async () => {
      service.findOne.mockResolvedValue(makeDto({ id: 'comment-1' }));

      const result = await controller.findOne('comment-1');

      expect(result.id).toBe('comment-1');
      expect(result.content).toBe('Great post!');
    });

    it('propagates NotFoundException when comment is not found', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('Comment with id "missing" not found'),
      );

      await expect(controller.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('calls service.update with id, dto, and userId', async () => {
      const dto: UpdateCommentDto = { content: 'Updated text' };
      service.update.mockResolvedValue(makeDto({ content: 'Updated text' }));

      await controller.update('comment-1', dto, mockUser);

      expect(service.update).toHaveBeenCalledWith('comment-1', dto, 'jwt-user-1');
    });

    it('returns the updated CommentDto', async () => {
      const dto: UpdateCommentDto = { content: 'New content' };
      service.update.mockResolvedValue(makeDto({ content: 'New content' }));

      const actual = await controller.update('comment-1', dto, mockUser);

      expect(actual.content).toBe('New content');
    });

    it('propagates NotFoundException when comment is not found', async () => {
      service.update.mockRejectedValue(
        new NotFoundException('Comment with id "missing" not found'),
      );

      await expect(
        controller.update('missing', { content: 'X' }, mockUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propagates other service errors', async () => {
      service.update.mockRejectedValue(new Error('DB error'));

      await expect(
        controller.update('comment-1', { content: 'X' }, mockUser),
      ).rejects.toThrow('DB error');
    });
  });

  describe('remove', () => {
    it('calls service.remove with id and userId', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove('comment-1', mockUser);

      expect(service.remove).toHaveBeenCalledWith('comment-1', 'jwt-user-1');
    });

    it('returns void on success', async () => {
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove('comment-1', mockUser);

      expect(result).toBeUndefined();
    });

    it('propagates NotFoundException when comment is not found', async () => {
      service.remove.mockRejectedValue(
        new NotFoundException('Comment with id "missing" not found'),
      );

      await expect(controller.remove('missing', mockUser)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propagates other service errors', async () => {
      service.remove.mockRejectedValue(new Error('DB error'));

      await expect(controller.remove('comment-1', mockUser)).rejects.toThrow('DB error');
    });
  });
});
