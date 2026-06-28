import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { LikesService } from './likes.service';
import { Like } from './entities/like.entity';
import { PostsService } from '../posts/posts.service';

describe('LikesService', () => {
  let service: LikesService;

  const mockPost = { id: 'post-1', authorId: 'author-1', isPremium: false };

  const mockLikesRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
  };

  const mockPostsService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LikesService,
        { provide: getRepositoryToken(Like), useValue: mockLikesRepository },
        { provide: PostsService, useValue: mockPostsService },
      ],
    }).compile();

    service = module.get<LikesService>(LikesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addLike', () => {
    it('returns 201 message when like is new', async () => {
      mockPostsService.findOne.mockResolvedValue(mockPost);
      mockLikesRepository.findOne.mockResolvedValue(null);
      mockLikesRepository.create.mockReturnValue({ userId: 'u1', postId: 'post-1' });
      mockLikesRepository.save.mockResolvedValue({});

      const result = await service.addLike('post-1', 'u1');

      expect(result).toEqual({ status: 201, message: 'Like added successfully' });
    });

    it('returns 200 message when like already exists (idempotent)', async () => {
      mockPostsService.findOne.mockResolvedValue(mockPost);
      mockLikesRepository.findOne.mockResolvedValue({ id: 'like-1' });

      const result = await service.addLike('post-1', 'u1');

      expect(result).toEqual({ status: 200, message: 'Post already liked' });
    });

    it('propagates NotFoundException from PostsService (consistent error shape)', async () => {
      mockPostsService.findOne.mockRejectedValue(new NotFoundException('Post not found'));

      await expect(service.addLike('missing-post', 'u1')).rejects.toMatchObject({
        status: 404,
        message: 'Post not found',
      });
    });
  });

  describe('removeLike', () => {
    it('removes the like successfully', async () => {
      mockPostsService.findOne.mockResolvedValue(mockPost);
      const like = { id: 'like-1' };
      mockLikesRepository.findOne.mockResolvedValue(like);
      mockLikesRepository.remove.mockResolvedValue(undefined);

      await expect(service.removeLike('post-1', 'u1')).resolves.toBeUndefined();
      expect(mockLikesRepository.remove).toHaveBeenCalledWith(like);
    });

    it('throws NotFoundException with consistent shape when like does not exist', async () => {
      mockPostsService.findOne.mockResolvedValue(mockPost);
      mockLikesRepository.findOne.mockResolvedValue(null);

      await expect(service.removeLike('post-1', 'u1')).rejects.toMatchObject({
        status: 404,
        message: 'Like not found',
      });
    });

    it('propagates NotFoundException when post does not exist', async () => {
      mockPostsService.findOne.mockRejectedValue(new NotFoundException('Post not found'));

      await expect(service.removeLike('missing-post', 'u1')).rejects.toMatchObject({
        status: 404,
        message: 'Post not found',
      });
    });
  });

  describe('getLikesCount', () => {
    it('returns the count from repository', async () => {
      mockLikesRepository.count.mockResolvedValue(7);

      const count = await service.getLikesCount('post-1');

      expect(count).toBe(7);
      expect(mockLikesRepository.count).toHaveBeenCalledWith({ where: { postId: 'post-1' } });
    });
  });

  describe('hasUserLiked', () => {
    it('returns true when like exists', async () => {
      mockLikesRepository.findOne.mockResolvedValue({ id: 'like-1' });

      expect(await service.hasUserLiked('post-1', 'u1')).toBe(true);
    });

    it('returns false when like does not exist', async () => {
      mockLikesRepository.findOne.mockResolvedValue(null);

      expect(await service.hasUserLiked('post-1', 'u1')).toBe(false);
    });
  });
});
