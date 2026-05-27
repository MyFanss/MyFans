import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';
import { EventBus } from '../events/event-bus';
import { PostDeletedEvent } from '../events/domain-events';

const makePost = (overrides: Partial<Post> = {}): Post =>
  ({
    id: 'post-1',
    title: 'Hello',
    content: 'World',
    authorId: 'author-1',
    isPublished: false,
    isPremium: false,
    likesCount: 0,
    likes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  }) as Post;

describe('PostsService', () => {
  let service: PostsService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
    delete: jest.Mock;
  };
  let queryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    take: jest.Mock;
    getMany: jest.Mock;
  };
  let eventBus: { publish: jest.Mock };

  beforeEach(async () => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };
    repo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(() => queryBuilder),
      delete: jest.fn(),
    };
    eventBus = { publish: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: getRepositoryToken(Post), useValue: repo },
        { provide: EventBus, useValue: eventBus },
      ],
    }).compile();

    service = module.get(PostsService);
  });

  describe('findAll', () => {
    it('excludes soft-deleted posts', async () => {
      const active = makePost();
      queryBuilder.getMany.mockResolvedValue([active]);

      await service.findAll({ limit: 20 });

      expect(repo.createQueryBuilder).toHaveBeenCalledWith('post');
      expect(queryBuilder.where).toHaveBeenCalledWith('post.deletedAt IS NULL');
    });

    it('returns first page with nextCursor when more posts exist', async () => {
      const posts = [
        makePost({ id: 'post-1' }),
        makePost({ id: 'post-2' }),
        makePost({ id: 'post-3' }),
      ];
      queryBuilder.getMany.mockResolvedValue(posts);

      const result = await service.findAll({ limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.nextCursor).toBe('post-2');
      expect(result.hasMore).toBe(true);
      expect(queryBuilder.take).toHaveBeenCalledWith(3);
    });

    it('returns the next slice when cursor is provided', async () => {
      queryBuilder.getMany.mockResolvedValue([makePost({ id: '3' })]);

      await service.findAll({ cursor: '2', limit: 2 });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('post.id > :cursorId', {
        cursorId: 2,
      });
    });

    it('ignores invalid cursor and returns the first page', async () => {
      queryBuilder.getMany.mockResolvedValue([makePost({ id: 'post-1' })]);

      const result = await service.findAll({ cursor: 'invalid', limit: 20 });

      expect(queryBuilder.andWhere).not.toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('findByAuthor', () => {
    it('excludes soft-deleted posts for the author', async () => {
      queryBuilder.getMany.mockResolvedValue([]);

      await service.findByAuthor('author-1', { limit: 20 });

      expect(queryBuilder.where).toHaveBeenCalledWith('post.authorId = :authorId', {
        authorId: 'author-1',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('post.deletedAt IS NULL');
    });
  });

  describe('findOne', () => {
    it('returns the post when active', async () => {
      const post = makePost();
      repo.findOne.mockResolvedValue(post);

      const result = await service.findOne('post-1');

      expect(result.id).toBe('post-1');
    });

    it('throws NotFoundException for a soft-deleted post', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('post-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('softDelete', () => {
    it('sets deletedAt and deletedBy then saves', async () => {
      const post = makePost();
      repo.findOne.mockResolvedValue(post);
      repo.save.mockResolvedValue({
        ...post,
        deletedAt: new Date(),
        deletedBy: 'user-99',
      });

      await service.softDelete('post-1', 'user-99');

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ deletedBy: 'user-99' }),
      );
      expect(post.deletedAt).not.toBeNull();
    });

    it('emits PostDeletedEvent with correct postId and deletedBy', async () => {
      const post = makePost();
      repo.findOne.mockResolvedValue(post);
      repo.save.mockResolvedValue(post);

      await service.softDelete('post-1', 'user-99');

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'post.deleted',
          postId: 'post-1',
          deletedBy: 'user-99',
        }),
      );
    });

    it('throws NotFoundException when post does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.softDelete('missing', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('does not emit event when post is already soft-deleted (not found)', async () => {
      repo.findOne.mockResolvedValue(null); // filtered out by IsNull()

      await expect(
        service.softDelete('post-1', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws NotFoundException for a soft-deleted post', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update('post-1', { title: 'New' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('PostDeletedEvent', () => {
    it('has the correct type discriminant', () => {
      const event = new PostDeletedEvent('p1', 'u1');
      expect(event.type).toBe('post.deleted');
      expect(event.postId).toBe('p1');
      expect(event.deletedBy).toBe('u1');
    });
  });
});
