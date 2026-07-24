import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { NotFoundException } from '@nestjs/common';
import { LikesController } from './likes.controller';
import { LikesService } from './likes.service';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { Reflector } from '@nestjs/core';

const mockUser = { userId: 'user-1' };

describe('LikesController', () => {
  let controller: LikesController;
  let service: jest.Mocked<
    Pick<
      LikesService,
      'addLike' | 'removeLike' | 'getLikesCount' | 'hasUserLiked'
    >
  >;

  beforeEach(async () => {
    service = {
      addLike: jest
        .fn()
        .mockResolvedValue({ status: 201, message: 'Like added successfully' }),
      removeLike: jest.fn().mockResolvedValue(undefined),
      getLikesCount: jest.fn().mockResolvedValue(42),
      hasUserLiked: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 10 }]),
      ],
      controllers: [LikesController],
      providers: [
        { provide: LikesService, useValue: service },
        Reflector,
        {
          provide: JwtAuthGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(LikesController);
  });

  describe('likePost', () => {
    it('delegates to service and returns like response', async () => {
      const result = await controller.likePost('post-1', mockUser);

      expect(service.addLike).toHaveBeenCalledWith('post-1', 'user-1');
      expect(result).toEqual({
        message: 'Like added successfully',
        postId: 'post-1',
        liked: true,
      });
    });

    it('returns idempotent response when post already liked', async () => {
      service.addLike.mockResolvedValue({
        status: 200,
        message: 'Post already liked',
      });

      const result = await controller.likePost('post-1', mockUser);

      expect(result).toEqual({
        message: 'Post already liked',
        postId: 'post-1',
        liked: true,
      });
    });

    it('propagates NotFoundException when post does not exist', async () => {
      service.addLike.mockRejectedValue(
        new NotFoundException('Post not found'),
      );

      await expect(controller.likePost('bad-post', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('unlikePost', () => {
    it('delegates to service and returns void', async () => {
      const result = await controller.unlikePost('post-1', mockUser);

      expect(service.removeLike).toHaveBeenCalledWith('post-1', 'user-1');
      expect(result).toBeUndefined();
    });

    it('propagates NotFoundException when like does not exist', async () => {
      service.removeLike.mockRejectedValue(
        new NotFoundException('Like not found'),
      );

      await expect(controller.unlikePost('post-1', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('propagates NotFoundException when post does not exist', async () => {
      service.removeLike.mockRejectedValue(
        new NotFoundException('Post not found'),
      );

      await expect(controller.unlikePost('bad-post', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getLikesCount', () => {
    it('delegates to service and returns count', async () => {
      const result = await controller.getLikesCount('post-1');

      expect(service.getLikesCount).toHaveBeenCalledWith('post-1');
      expect(result).toEqual({ count: 42 });
    });

    it('returns zero count when post has no likes', async () => {
      service.getLikesCount.mockResolvedValue(0);

      const result = await controller.getLikesCount('post-1');

      expect(result).toEqual({ count: 0 });
    });
  });

  describe('getLikeStatus', () => {
    it('returns liked true when user has liked the post', async () => {
      const result = await controller.getLikeStatus('post-1', mockUser);

      expect(service.hasUserLiked).toHaveBeenCalledWith('post-1', 'user-1');
      expect(result).toEqual({ liked: true });
    });

    it('returns liked false when user has not liked the post', async () => {
      service.hasUserLiked.mockResolvedValue(false);

      const result = await controller.getLikeStatus('post-1', mockUser);

      expect(result).toEqual({ liked: false });
    });
  });
});
