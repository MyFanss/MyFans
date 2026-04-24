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
    findAndCount: jest.Mock;
    delete: jest.Mock;
  };
  let eventBus: { publish: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
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
      repo.findAndCount.mockResolvedValue([[active], 1]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.total).toBe(1);
      // Verify the query filters by deletedAt: IsNull()
      const [options] = repo.findAndCount.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      expect(Object.keys(options.where)).toContain('deletedAt');
    });
  });

  describe('findByAuthor', () => {
    it('excludes soft-deleted posts for the author', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findByAuthor('author-1', { page: 1, limit: 20 });

      const [options] = repo.findAndCount.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      expect(options.where).toHaveProperty('authorId', 'author-1');
      expect(Object.keys(options.where)).toContain('deletedAt');
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
