import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { PostDto, CreatePostDto, UpdatePostDto } from './dto';
import { PaginatedResponseDto } from '../common/dto';

const makeDto = (overrides: Partial<PostDto> = {}): PostDto =>
  ({
    id: 'post-1',
    title: 'Hello',
    content: 'World',
    authorId: 'author-1',
    isPublished: false,
    isPremium: false,
    likesCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  }) as PostDto;

const makePaginatedResponse = (
  data: PostDto[],
  overrides?: Partial<PaginatedResponseDto<PostDto>>,
): PaginatedResponseDto<PostDto> =>
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
  }) as PaginatedResponseDto<PostDto>;

describe('PostsController', () => {
  let controller: PostsController;
  let service: jest.Mocked<
    Pick<
      PostsService,
      | 'create'
      | 'findAll'
      | 'findByAuthor'
      | 'findOne'
      | 'update'
      | 'softDelete'
    >
  >;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findByAuthor: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }]),
      ],
      controllers: [PostsController],
      providers: [{ provide: PostsService, useValue: service }],
    }).compile();

    controller = module.get(PostsController);
  });

  afterEach(() => jest.clearAllMocks());

  // ── POST /posts ────────────────────────────────────────────────────────────

  describe('create', () => {
    it('calls service.create with authorId and dto', async () => {
      const dto: CreatePostDto = { title: 'New Post', content: 'Content' };
      const result = makeDto({ title: 'New Post', content: 'Content' });
      service.create.mockResolvedValue(result);

      const actual = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith('temp-author-id', dto);
      expect(actual).toEqual(result);
    });

    it('returns created post with id', async () => {
      const dto: CreatePostDto = { title: 'New Post', content: 'Body' };
      const result = makeDto({
        id: 'new-post-id',
        title: 'New Post',
        content: 'Body',
      });
      service.create.mockResolvedValue(result);

      const actual = await controller.create(dto);

      expect(actual.id).toBe('new-post-id');
      expect(actual.title).toBe('New Post');
    });

    it('sets isPublished and isPremium from dto', async () => {
      const dto: CreatePostDto = {
        title: 'Premium Post',
        content: 'Content',
        isPublished: true,
        isPremium: true,
      };
      const result = makeDto({
        title: 'Premium Post',
        isPublished: true,
        isPremium: true,
      });
      service.create.mockResolvedValue(result);

      const actual = await controller.create(dto);

      expect(actual.isPublished).toBe(true);
      expect(actual.isPremium).toBe(true);
    });

    it('propagates service errors', async () => {
      const dto: CreatePostDto = { title: 'Test', content: 'Content' };
      const error = new Error('DB error');
      service.create.mockRejectedValue(error);

      await expect(controller.create(dto)).rejects.toThrow(error);
    });
  });

  // ── GET /posts ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('calls service.findAll with pagination', async () => {
      const pagination = { page: 2, limit: 10 };
      const result = makePaginatedResponse([makeDto()]);
      service.findAll.mockResolvedValue(result);

      await controller.findAll(pagination);

      expect(service.findAll).toHaveBeenCalledWith(pagination);
    });

    it('returns paginated posts (soft-deleted excluded by service)', async () => {
      const pagination = { page: 1, limit: 20 };
      const result = makePaginatedResponse(
        [makeDto({ id: 'post-1' }), makeDto({ id: 'post-2' })],
        { total: 2, page: 1, limit: 20 },
      );
      service.findAll.mockResolvedValue(result);

      const actual = await controller.findAll(pagination);

      expect(actual.data).toHaveLength(2);
      expect(actual.page).toBe(1);
      expect(actual.limit).toBe(20);
      expect(actual.total).toBe(2);
    });

    it('returns empty list when no posts', async () => {
      const pagination = { page: 1, limit: 20 };
      const result = makePaginatedResponse([]);
      service.findAll.mockResolvedValue(result);

      const actual = await controller.findAll(pagination);

      expect(actual.data).toHaveLength(0);
    });

    it('propagates service errors', async () => {
      const pagination = { page: 1, limit: 20 };
      const error = new Error('DB error');
      service.findAll.mockRejectedValue(error);

      await expect(controller.findAll(pagination)).rejects.toThrow(error);
    });
  });

  // ── GET /posts/author/:authorId ──────────────────────────────────────────────

  describe('findByAuthor', () => {
    it('calls service.findByAuthor with authorId and pagination', async () => {
      const authorId = 'author-123';
      const pagination = { page: 1, limit: 20 };
      const result = makePaginatedResponse([makeDto({ authorId })]);
      service.findByAuthor.mockResolvedValue(result);

      await controller.findByAuthor(authorId, pagination);

      expect(service.findByAuthor).toHaveBeenCalledWith(authorId, pagination);
    });

    it('returns author posts', async () => {
      const authorId = 'author-123';
      const pagination = { page: 1, limit: 20 };
      const result = makePaginatedResponse([
        makeDto({ id: 'post-1', authorId }),
        makeDto({ id: 'post-2', authorId }),
      ]);
      service.findByAuthor.mockResolvedValue(result);

      const actual = await controller.findByAuthor(authorId, pagination);

      expect(actual.data).toHaveLength(2);
      expect(actual.data.every((p) => p.authorId === authorId)).toBe(true);
    });

    it('returns empty list when author has no posts', async () => {
      const authorId = 'author-no-posts';
      const pagination = { page: 1, limit: 20 };
      const result = makePaginatedResponse([]);
      service.findByAuthor.mockResolvedValue(result);

      const actual = await controller.findByAuthor(authorId, pagination);

      expect(actual.data).toHaveLength(0);
    });

    it('propagates service errors', async () => {
      const authorId = 'author-123';
      const pagination = { page: 1, limit: 20 };
      const error = new Error('DB error');
      service.findByAuthor.mockRejectedValue(error);

      await expect(
        controller.findByAuthor(authorId, pagination),
      ).rejects.toThrow(error);
    });
  });

  // ── GET /posts/:id ──────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('calls service.findOne with id', async () => {
      const result = makeDto();
      service.findOne.mockResolvedValue(result);

      await controller.findOne('post-1');

      expect(service.findOne).toHaveBeenCalledWith('post-1');
    });

    it('returns the post when active', async () => {
      service.findOne.mockResolvedValue(makeDto());

      const result = await controller.findOne('post-1');

      expect(result.id).toBe('post-1');
      expect(result.title).toBe('Hello');
    });

    it('propagates NotFoundException when post not found', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('Post with ID missing not found'),
      );

      await expect(controller.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('propagates NotFoundException for soft-deleted post', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('Post with ID post-1 not found'),
      );

      await expect(controller.findOne('post-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── PUT /posts/:id ──────────────────────────────────────────────────────────

  describe('update', () => {
    it('calls service.update with id and dto', async () => {
      const dto: UpdatePostDto = { title: 'Updated' };
      const result = makeDto({ title: 'Updated' });
      service.update.mockResolvedValue(result);

      await controller.update('post-1', dto);

      expect(service.update).toHaveBeenCalledWith('post-1', dto);
    });

    it('returns updated post', async () => {
      const dto: UpdatePostDto = { title: 'New Title', isPublished: true };
      const result = makeDto({
        title: 'New Title',
        isPublished: true,
      });
      service.update.mockResolvedValue(result);

      const actual = await controller.update('post-1', dto);

      expect(actual.title).toBe('New Title');
      expect(actual.isPublished).toBe(true);
    });

    it('allows partial updates', async () => {
      const dto: UpdatePostDto = { title: 'Only Title Changed' };
      const result = makeDto({
        title: 'Only Title Changed',
        content: 'World',
      });
      service.update.mockResolvedValue(result);

      const actual = await controller.update('post-1', dto);

      expect(actual.title).toBe('Only Title Changed');
      expect(actual.content).toBe('World');
    });

    it('propagates NotFoundException when post not found', async () => {
      const dto: UpdatePostDto = { title: 'New' };
      service.update.mockRejectedValue(
        new NotFoundException('Post with ID missing not found'),
      );

      await expect(controller.update('missing', dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('propagates NotFoundException when updating a soft-deleted post', async () => {
      const dto: UpdatePostDto = { title: 'New' };
      service.update.mockRejectedValue(
        new NotFoundException('Post with ID post-1 not found'),
      );

      await expect(controller.update('post-1', dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── DELETE /posts/:id ────────────────────────────────────────────────────────

  describe('remove (soft-delete)', () => {
    it('calls softDelete with the given id and deletedBy', async () => {
      service.softDelete.mockResolvedValue(undefined);

      await controller.remove('post-1', 'user-99');

      expect(service.softDelete).toHaveBeenCalledWith('post-1', 'user-99');
    });

    it('defaults deletedBy to "unknown" when query param is absent', async () => {
      service.softDelete.mockResolvedValue(undefined);

      await controller.remove('post-1', undefined);

      expect(service.softDelete).toHaveBeenCalledWith('post-1', 'unknown');
    });

    it('returns void (no body) on success', async () => {
      service.softDelete.mockResolvedValue(undefined);

      const result = await controller.remove('post-1', 'user-1');

      expect(result).toBeUndefined();
    });

    it('propagates NotFoundException when post does not exist', async () => {
      service.softDelete.mockRejectedValue(
        new NotFoundException('Post with ID missing not found'),
      );

      await expect(
        controller.remove('missing', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propagates NotFoundException when post is already soft-deleted', async () => {
      service.softDelete.mockRejectedValue(
        new NotFoundException('Post with ID post-1 not found'),
      );

      await expect(
        controller.remove('post-1', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propagates other errors', async () => {
      const error = new Error('DB error');
      service.softDelete.mockRejectedValue(error);

      await expect(controller.remove('post-1', 'user-1')).rejects.toThrow(
        error,
      );
    });
  });
});
