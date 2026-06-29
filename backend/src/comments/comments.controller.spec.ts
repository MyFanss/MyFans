import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { CommentDto, CreateCommentDto, UpdateCommentDto } from './dto';
import { PaginatedResponseDto } from '../common/dto';

// ── factories ────────────────────────────────────────────────────────────────

const makeDto = (overrides: Partial<CommentDto> = {}): CommentDto =>
  ({
    id: 'comment-1',
    content: 'Great post!',
    authorId: 'temp-author-id',
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

// ── suite ────────────────────────────────────────────────────────────────────

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
      providers: [{ provide: CommentsService, useValue: service }],
    }).compile();

    controller = module.get(CommentsController);
  });

  afterEach(() => jest.clearAllMocks());

  // ── POST /comments ─────────────────────────────────────────────────────────

  describe('create', () => {
    it('calls service.create with hardcoded authorId and the dto', async () => {
      const dto: CreateCommentDto = {
        content: 'Great post!',
        postId: '00000000-0000-4000-8000-000000000001',
      };
      const result = makeDto();
      service.create.mockResolvedValue(result);

      const actual = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith('temp-author-id', dto);
      expect(actual).toEqual(result);
    });

    it('returns the created CommentDto with an id', async () => {
      const dto: CreateCommentDto = {
        content: 'Hello',
        postId: '00000000-0000-4000-8000-000000000001',
      };
      const result = makeDto({ id: 'new-comment-id', content: 'Hello' });
      service.create.mockResolvedValue(result);

      const actual = await controller.create(dto);

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

      const actual = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(
        'temp-author-id',
        expect.objectContaining({ parentId }),
      );
      expect(actual.parentId).toBe(parentId);
    });

    it('propagates service errors', async () => {
      const dto: CreateCommentDto = {
        content: 'Test',
        postId: '00000000-0000-4000-8000-000000000001',
      };
      service.create.mockRejectedValue(new Error('DB error'));

      await expect(controller.create(dto)).rejects.toThrow('DB error');
    });
  });

  // ── GET /comments ──────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('calls service.findAll with the pagination params', async () => {
      const pagination = { page: 2, limit: 10 };
      const result = makePaginatedResponse([makeDto()]);
      service.findAll.mockResolvedValue(result);

      await controller.findAll(pagination);

      expect(service.findAll).toHaveBeenCalledWith(pagination);
    });

    it('returns the paginated comments list', async () => {
      const pagination = { page: 1, limit: 20 };
      const result = makePaginatedResponse(
        [makeDto({ id: 'comment-1' }), makeDto({ id: 'comment-2' })],
        { total: 2, page: 1, limit: 20 },
      );
      service.findAll.mockResolvedValue(result);

      const actual = await controller.findAll(pagination);

      expect(actual.data).toHaveLength(2);
      expect(actual.page).toBe(1);
      expect(actual.limit).toBe(20);
      expect(actual.total).toBe(2);
    });

    it('returns an empty list when there are no comments', async () => {
      service.findAll.mockResolvedValue(makePaginatedResponse([]));

      const actual = await controller.findAll({ page: 1, limit: 20 });

      expect(actual.data).toHaveLength(0);
      expect(actual.total).toBe(0);
    });

    it('propagates service errors', async () => {
      service.findAll.mockRejectedValue(new Error('DB error'));

      await expect(controller.findAll({ page: 1, limit: 20 })).rejects.toThrow('DB error');
    });
  });

  // ── GET /comments/post/:postId ─────────────────────────────────────────────

  describe('findByPost', () => {
    it('calls service.findByPost with postId and pagination', async () => {
      const postId = '00000000-0000-4000-8000-000000000001';
      const pagination = { page: 1, limit: 20 };
      const result = makePaginatedResponse([makeDto({ postId })]);
      service.findByPost.mockResolvedValue(result);

      await controller.findByPost(postId, pagination);

      expect(service.findByPost).toHaveBeenCalledWith(postId, pagination);
    });

    it('returns comments filtered by postId', async () => {
      const postId = '00000000-0000-4000-8000-000000000001';
      const result = makePaginatedResponse([
        makeDto({ id: 'comment-1', postId }),
        makeDto({ id: 'comment-2', postId }),
      ]);
      service.findByPost.mockResolvedValue(result);

      const actual = await controller.findByPost(postId, { page: 1, limit: 20 });

      expect(actual.data).toHaveLength(2);
      expect(actual.data.every((c) => c.postId === postId)).toBe(true);
    });

    it('returns empty list when the post has no comments', async () => {
      service.findByPost.mockResolvedValue(makePaginatedResponse([]));

      const actual = await controller.findByPost('post-empty', { page: 1, limit: 20 });

      expect(actual.data).toHaveLength(0);
      expect(actual.total).toBe(0);
    });

    it('propagates service errors', async () => {
      service.findByPost.mockRejectedValue(new Error('DB error'));

      await expect(
        controller.findByPost('post-1', { page: 1, limit: 20 }),
      ).rejects.toThrow('DB error');
    });
  });

  // ── GET /comments/:id ──────────────────────────────────────────────────────

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

  // ── PUT /comments/:id ──────────────────────────────────────────────────────

  describe('update', () => {
    it('calls service.update with id and dto', async () => {
      const dto: UpdateCommentDto = { content: 'Updated text' };
      service.update.mockResolvedValue(makeDto({ content: 'Updated text' }));

      await controller.update('comment-1', dto);

      expect(service.update).toHaveBeenCalledWith('comment-1', dto);
    });

    it('returns the updated CommentDto', async () => {
      const dto: UpdateCommentDto = { content: 'New content' };
      service.update.mockResolvedValue(makeDto({ content: 'New content' }));

      const actual = await controller.update('comment-1', dto);

      expect(actual.content).toBe('New content');
    });

    it('propagates NotFoundException when comment is not found', async () => {
      service.update.mockRejectedValue(
        new NotFoundException('Comment with id "missing" not found'),
      );

      await expect(
        controller.update('missing', { content: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propagates other service errors', async () => {
      service.update.mockRejectedValue(new Error('DB error'));

      await expect(
        controller.update('comment-1', { content: 'X' }),
      ).rejects.toThrow('DB error');
    });
  });

  // ── DELETE /comments/:id ───────────────────────────────────────────────────

  describe('remove', () => {
    it('calls service.remove with the id', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove('comment-1');

      expect(service.remove).toHaveBeenCalledWith('comment-1');
    });

    it('returns void on success', async () => {
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove('comment-1');

      expect(result).toBeUndefined();
    });

    it('propagates NotFoundException when comment is not found', async () => {
      service.remove.mockRejectedValue(
        new NotFoundException('Comment with id "missing" not found'),
      );

      await expect(controller.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propagates other service errors', async () => {
      service.remove.mockRejectedValue(new Error('DB error'));

      await expect(controller.remove('comment-1')).rejects.toThrow('DB error');
    });
  });
});
