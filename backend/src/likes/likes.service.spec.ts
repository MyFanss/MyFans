import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Like } from './entities/like.entity';
import { Post } from '../posts/entities/post.entity';
import { Comment } from '../comments/entities/comment.entity';
import { LikesService } from './likes.service';

describe('LikesService', () => {
  let service: LikesService;

  const likeRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };

  const postRepo = {
    findOne: jest.fn(),
  };

  const commentRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        LikesService,
        { provide: getRepositoryToken(Like), useValue: likeRepo },
        { provide: getRepositoryToken(Post), useValue: postRepo },
        { provide: getRepositoryToken(Comment), useValue: commentRepo },
      ],
    }).compile();

    service = moduleRef.get<LikesService>(LikesService);
  });

  describe('like', () => {
    it('creates a like when the post exists and no like is present', async () => {
      postRepo.findOne.mockResolvedValue({ id: 'post-1' });
      likeRepo.findOne.mockResolvedValue(null);
      likeRepo.save.mockImplementation(async (entity) => entity);

      const result = await service.like('user-1', 'post-1');

      expect(postRepo.findOne).toHaveBeenCalledWith({ where: { id: 'post-1' } });
      expect(likeRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-1', postId: 'post-1' },
      });
      expect(likeRepo.save).toHaveBeenCalledTimes(1);
      expect(likeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', postId: 'post-1' }),
      );
      expect(result).toBeDefined();
    });

    it('is idempotent when re-liking the same post (no duplicate row)', async () => {
      postRepo.findOne.mockResolvedValue({ id: 'post-1' });
      const existing = { id: 'like-1', userId: 'user-1', postId: 'post-1' };
      likeRepo.findOne.mockResolvedValue(existing);

      const result = await service.like('user-1', 'post-1');

      expect(likeRepo.save).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });

    it('does not create a like when the target post does not exist', async () => {
      postRepo.findOne.mockResolvedValue(null);

      await expect(service.like('user-1', 'missing-post')).rejects.toThrow();

      expect(likeRepo.findOne).not.toHaveBeenCalled();
      expect(likeRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('unlike', () => {
    it('deletes the like for the given user and post', async () => {
      likeRepo.delete.mockResolvedValue({ affected: 1 });

      await service.unlike('user-1', 'post-1');

      expect(likeRepo.delete).toHaveBeenCalledWith({
        userId: 'user-1',
        postId: 'post-1',
      });
    });
  });

  describe('count', () => {
    it('returns the number of likes for a post', async () => {
      likeRepo.count.mockResolvedValue(3);

      const result = await service.count('post-1');

      expect(likeRepo.count).toHaveBeenCalledWith({ where: { postId: 'post-1' } });
      expect(result).toBe(3);
    });
  });

  describe('hasLiked', () => {
    it('returns true when a like exists', async () => {
      likeRepo.findOne.mockResolvedValue({ id: 'like-1' });

      const result = await service.hasLiked('user-1', 'post-1');

      expect(likeRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-1', postId: 'post-1' },
      });
      expect(result).toBe(true);
    });

    it('returns false when no like exists', async () => {
      likeRepo.findOne.mockResolvedValue(null);

      const result = await service.hasLiked('user-1', 'post-1');

      expect(result).toBe(false);
    });
  });
});
