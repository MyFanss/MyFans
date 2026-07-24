import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LikesService } from './likes.service';
import { Like } from './entities/like.entity';
import { PostsService } from '../posts/posts.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

const mockPost = {
  id: 'post-1',
  authorId: 'author-1',
  isPremium: false,
  title: 'Test Post',
  content: 'Test content',
  isPublished: true,
  likesCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

function makeLike(overrides: Partial<Like> = {}): Like {
  return {
    id: 'like-1',
    userId: 'user-1',
    postId: 'post-1',
    createdAt: new Date(),
    user: undefined as never,
    post: undefined as never,
    ...overrides,
  };
}

describe('LikesService – happy path', () => {
  let service: LikesService;
  let likes: Like[];

  const mockRepo = {
    findOne: jest.fn(({ where }: { where: Partial<Like> }) =>
      Promise.resolve(
        likes.find(
          (l) =>
            (!where.userId || l.userId === where.userId) &&
            (!where.postId || l.postId === where.postId),
        ) ?? null,
      ),
    ),
    create: jest.fn((data: Partial<Like>) => makeLike(data)),
    save: jest.fn((like: Like) => {
      likes.push(like);
      return Promise.resolve(like);
    }),
    remove: jest.fn((like: Like) => {
      likes = likes.filter((l) => l.id !== like.id);
      return Promise.resolve();
    }),
    count: jest.fn(({ where }: { where: Partial<Like> }) =>
      Promise.resolve(
        likes.filter((l) => !where.postId || l.postId === where.postId).length,
      ),
    ),
    findAndCount: jest.fn(
      ({
        where,
        skip = 0,
        take = likes.length,
      }: {
        where?: Partial<Like>;
        skip?: number;
        take?: number;
      }) => {
        const filtered = likes.filter(
          (l) => !where?.postId || l.postId === where.postId,
        );
        return Promise.resolve([
          filtered.slice(skip, skip + take),
          filtered.length,
        ]);
      },
    ),
  };

  const mockPostsService = {
    findOne: jest.fn(() => Promise.resolve(mockPost)),
  };

  const mockSubscriptionsService = {
    isSubscriber: jest.fn(() => Promise.resolve(true)),
  };

  beforeEach(async () => {
    likes = [];
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LikesService,
        { provide: getRepositoryToken(Like), useValue: mockRepo },
        { provide: PostsService, useValue: mockPostsService },
        { provide: SubscriptionsService, useValue: mockSubscriptionsService },
      ],
    }).compile();

    service = module.get(LikesService);
  });

  describe('addLike', () => {
    it('creates a new like and returns status 201', async () => {
      const result = await service.addLike('post-1', 'user-1');

      expect(result.status).toBe(201);
      expect(result.message).toBe('Like added successfully');
      expect(mockRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        postId: 'post-1',
      });
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('returns status 200 when user has already liked the post (idempotent)', async () => {
      likes.push(makeLike({ userId: 'user-1', postId: 'post-1' }));

      const result = await service.addLike('post-1', 'user-1');

      expect(result.status).toBe(200);
      expect(result.message).toBe('Post already liked');
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('verifies the post exists before liking', async () => {
      await service.addLike('post-1', 'user-1');

      expect(mockPostsService.findOne).toHaveBeenCalledWith('post-1');
    });

    it('throws NotFoundException when post does not exist', async () => {
      mockPostsService.findOne.mockRejectedValueOnce(
        new NotFoundException('Post with ID nonexistent not found'),
      );

      await expect(service.addLike('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('allows liking a free post without checking subscription status', async () => {
      const result = await service.addLike('post-1', 'user-1');

      expect(result.status).toBe(201);
      expect(mockSubscriptionsService.isSubscriber).not.toHaveBeenCalled();
    });

    it('allows liking a premium post when the user has an active subscription', async () => {
      mockPostsService.findOne.mockResolvedValueOnce({
        ...mockPost,
        isPremium: true,
      });
      mockSubscriptionsService.isSubscriber.mockResolvedValueOnce(true);

      const result = await service.addLike('post-1', 'user-1');

      expect(result.status).toBe(201);
      expect(mockSubscriptionsService.isSubscriber).toHaveBeenCalledWith(
        'user-1',
        'author-1',
      );
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('throws ForbiddenException when liking a premium post without an active subscription', async () => {
      mockPostsService.findOne.mockResolvedValueOnce({
        ...mockPost,
        isPremium: true,
      });
      mockSubscriptionsService.isSubscriber.mockResolvedValueOnce(false);

      await expect(service.addLike('post-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockRepo.create).not.toHaveBeenCalled();
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('removeLike', () => {
    it('removes an existing like', async () => {
      likes.push(makeLike({ userId: 'user-1', postId: 'post-1' }));

      await service.removeLike('post-1', 'user-1');

      expect(mockRepo.remove).toHaveBeenCalled();
    });

    it('throws NotFoundException when like does not exist', async () => {
      await expect(
        service.removeLike('post-1', 'user-no-like'),
      ).rejects.toThrow(NotFoundException);
    });

    it('verifies the post exists before removing', async () => {
      likes.push(makeLike({ userId: 'user-1', postId: 'post-1' }));
      await service.removeLike('post-1', 'user-1');

      expect(mockPostsService.findOne).toHaveBeenCalledWith('post-1');
    });
  });

  describe('getLikesCount', () => {
    it('returns 0 when no likes exist', async () => {
      const count = await service.getLikesCount('post-1');
      expect(count).toBe(0);
    });

    it('returns the correct count of likes', async () => {
      likes.push(
        makeLike({ id: 'like-1', userId: 'user-1', postId: 'post-1' }),
        makeLike({ id: 'like-2', userId: 'user-2', postId: 'post-1' }),
      );

      const count = await service.getLikesCount('post-1');
      expect(count).toBe(2);
    });

    it('counts only likes for the given post', async () => {
      likes.push(
        makeLike({ id: 'like-1', userId: 'user-1', postId: 'post-1' }),
        makeLike({ id: 'like-2', userId: 'user-2', postId: 'post-2' }),
      );

      const count = await service.getLikesCount('post-1');
      expect(count).toBe(1);
    });
  });

  describe('hasUserLiked', () => {
    it('returns true when user has liked the post', async () => {
      likes.push(makeLike({ userId: 'user-1', postId: 'post-1' }));

      const result = await service.hasUserLiked('post-1', 'user-1');
      expect(result).toBe(true);
    });

    it('returns false when user has not liked the post', async () => {
      const result = await service.hasUserLiked('post-1', 'user-1');
      expect(result).toBe(false);
    });

    it('returns false for a different user', async () => {
      likes.push(makeLike({ userId: 'user-2', postId: 'post-1' }));

      const result = await service.hasUserLiked('post-1', 'user-1');
      expect(result).toBe(false);
    });
  });

  describe('getLikesByPost', () => {
    it('returns empty result when no likes exist', async () => {
      const result = await service.getLikesByPost('post-1');

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('returns paginated likes for a post', async () => {
      for (let i = 1; i <= 3; i++) {
        likes.push(
          makeLike({ id: `like-${i}`, userId: `user-${i}`, postId: 'post-1' }),
        );
      }

      const result = await service.getLikesByPost('post-1', 1, 2);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
      expect(result.hasMore).toBe(true);
    });

    it('returns last page with hasMore=false', async () => {
      for (let i = 1; i <= 3; i++) {
        likes.push(
          makeLike({ id: `like-${i}`, userId: `user-${i}`, postId: 'post-1' }),
        );
      }

      const result = await service.getLikesByPost('post-1', 2, 2);

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it('uses default page=1 and limit=20', async () => {
      const result = await service.getLikesByPost('post-1');

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });
});
