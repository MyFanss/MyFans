import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { PostDto } from './dto';

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

describe('PostsController', () => {
  let controller: PostsController;
  let service: jest.Mocked<
    Pick<
      PostsService,
      'create' | 'findAll' | 'findByAuthor' | 'findOne' | 'update' | 'softDelete'
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
      controllers: [PostsController],
      providers: [{ provide: PostsService, useValue: service }],
    }).compile();

    controller = module.get(PostsController);
  });

  afterEach(() => jest.clearAllMocks());

  // ── DELETE (soft-delete) ────────────────────────────────────────────────────

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

      await expect(controller.remove('missing', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('propagates NotFoundException when post is already soft-deleted', async () => {
      service.softDelete.mockRejectedValue(
        new NotFoundException('Post with ID post-1 not found'),
      );

      await expect(controller.remove('post-1', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── GET /posts ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated posts (soft-deleted excluded by service)', async () => {
      const page = {
        data: [makeDto()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasMore: false,
        nextCursor: null,
        cursor: null,
      };
      service.findAll.mockResolvedValue(page as any);

      const result = await controller.findAll({ page: 1, limit: 20 });

      expect(service.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
      expect(result.data).toHaveLength(1);
    });
  });

  // ── GET /posts/:id ──────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the post when active', async () => {
      service.findOne.mockResolvedValue(makeDto());

      const result = await controller.findOne('post-1');

      expect(result.id).toBe('post-1');
    });

    it('propagates NotFoundException for soft-deleted post', async () => {
      service.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne('post-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── PUT /posts/:id ──────────────────────────────────────────────────────────

  describe('update', () => {
    it('propagates NotFoundException when updating a soft-deleted post', async () => {
      service.update.mockRejectedValue(new NotFoundException());

      await expect(
        controller.update('post-1', { title: 'New' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
