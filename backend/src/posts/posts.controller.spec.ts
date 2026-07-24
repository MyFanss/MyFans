import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { PostDto, CreatePostDto, UpdatePostDto } from './dto';
import { PaginatedResponseDto } from '../common/dto';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';

const mockUser = { userId: 'jwt-user-1' };

const makeDto = (overrides: Partial<PostDto> = {}): PostDto =>
  ({
    id: 'post-1',
    title: 'Hello',
    content: 'World',
    authorId: 'jwt-user-1',
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
      providers: [
        { provide: PostsService, useValue: service },
        { provide: JwtAuthGuard, useValue: { canActivate: jest.fn().mockReturnValue(true) } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(PostsController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('calls service.create with JWT userId and dto', async () => {
      const dto: CreatePostDto = { title: 'New Post', content: 'Content' };
      const result = makeDto({ title: 'New Post', content: 'Content' });
      service.create.mockResolvedValue(result);

      const actual = await controller.create(dto, mockUser);

      expect(service.create).toHaveBeenCalledWith('jwt-user-1', dto);
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

      const actual = await controller.create(dto, mockUser);

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

      const actual = await controller.create(dto, mockUser);

      expect(actual.isPublished).toBe(true);
      expect(actual.isPremium).toBe(true);
    });

    it('propagates service errors', async () => {
      service.create.mockRejectedValue(new Error('DB error'));

      await expect(
        controller.create({ title: 'Fail', content: 'X' } as CreatePostDto, mockUser),
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
      expect(actual).toBe(expected);
    });

    it('returns empty list when no posts exist', async () => {
      const pagination = { page: 1, limit: 20 };
      const expected = makePaginatedResponse([]);
      service.findAll.mockResolvedValue(expected);

      const actual = await controller.findAll(pagination);

      expect(actual.data).toHaveLength(0);
      expect(actual.total).toBe(0);
    });
  });

  describe('findByAuthor', () => {
    it('calls service.findByAuthor with authorId and pagination', async () => {
      const pagination = { page: 1, limit: 20 };
      const expected = makePaginatedResponse([makeDto()]);
      service.findByAuthor.mockResolvedValue(expected);

      const actual = await controller.findByAuthor('author-1', pagination);

      expect(service.findByAuthor).toHaveBeenCalledWith('author-1', pagination);
      expect(actual).toBe(expected);
    });
  });

  describe('findOne', () => {
    it('calls service.findOne with id', async () => {
      service.findOne.mockResolvedValue(makeDto());

      await controller.findOne('post-1');

      expect(service.findOne).toHaveBeenCalledWith('post-1');
    });

    it('returns the post when it exists', async () => {
      service.findOne.mockResolvedValue(makeDto({ id: 'post-1' }));

      const result = await controller.findOne('post-1');

      expect(result.id).toBe('post-1');
    });

    it('propagates NotFoundException when post does not exist', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('Post with ID missing not found'),
      );

      await expect(controller.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('calls service.update with id, dto, and userId', async () => {
      const dto: UpdatePostDto = { title: 'New Title' };
      const result = makeDto({ title: 'New Title' });
      service.update.mockResolvedValue(result);

      await controller.update('post-1', dto, mockUser);

      expect(service.update).toHaveBeenCalledWith('post-1', dto, 'jwt-user-1');
    });

    it('returns the updated PostDto', async () => {
      const dto = { title: 'New Title', isPublished: true };
      const result = makeDto({
        title: 'New Title',
        isPublished: true,
      });
      service.update.mockResolvedValue(result);

      const actual = await controller.update('post-1', dto as UpdatePostDto, mockUser);

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

      const actual = await controller.update('post-1', dto, mockUser);

      expect(actual.title).toBe('Only Title Changed');
      expect(actual.content).toBe('World');
    });

    it('propagates NotFoundException when post not found', async () => {
      const dto: UpdatePostDto = { title: 'New' };
      service.update.mockRejectedValue(
        new NotFoundException('Post with ID missing not found'),
      );

      await expect(
        controller.update('missing', dto, mockUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propagates NotFoundException when updating a soft-deleted post', async () => {
      const dto: UpdatePostDto = { title: 'New' };
      service.update.mockRejectedValue(
        new NotFoundException('Post with ID post-1 not found'),
      );

      await expect(
        controller.update('post-1', dto, mockUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove (soft-delete)', () => {
    it('calls softDelete with the given id and JWT userId', async () => {
      service.softDelete.mockResolvedValue(undefined);

      await controller.remove('post-1', mockUser);

      expect(service.softDelete).toHaveBeenCalledWith('post-1', 'jwt-user-1');
    });

    it('returns void (no body) on success', async () => {
      service.softDelete.mockResolvedValue(undefined);

      const result = await controller.remove('post-1', mockUser);

      expect(result).toBeUndefined();
    });

    it('propagates NotFoundException when post does not exist', async () => {
      service.softDelete.mockRejectedValue(
        new NotFoundException('Post with ID missing not found'),
      );

      await expect(
        controller.remove('missing', mockUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propagates NotFoundException when post is already soft-deleted', async () => {
      service.softDelete.mockRejectedValue(
        new NotFoundException('Post with ID post-1 not found'),
      );

      await expect(
        controller.remove('post-1', mockUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propagates other errors', async () => {
      const error = new Error('DB error');
      service.softDelete.mockRejectedValue(error);

      await expect(controller.remove('post-1', mockUser)).rejects.toThrow(
        error,
      );
    });
  });
});
