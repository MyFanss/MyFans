import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { LikesController } from './likes.controller';
import { LikesService } from './likes.service';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';

// Decorator metadata lives on the unbound prototype methods, so reading it
// back is exactly what these specs are meant to do.
/* eslint-disable @typescript-eslint/unbound-method */

describe('LikesController – rate limiting', () => {
  let controller: LikesController;

  const mockLikesService = {
    addLike: jest
      .fn()
      .mockResolvedValue({ status: 201, message: 'Like added successfully' }),
    removeLike: jest.fn().mockResolvedValue(undefined),
    getLikesCount: jest.fn().mockResolvedValue(0),
    hasUserLiked: jest.fn().mockResolvedValue(false),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 10 }]),
      ],
      controllers: [LikesController],
      providers: [
        { provide: LikesService, useValue: mockLikesService },
        { provide: JwtAuthGuard, useValue: { canActivate: () => true } },
        Reflector,
      ],
    }).compile();

    controller = module.get<LikesController>(LikesController);
  });

  it('should have ThrottlerGuard applied at controller level', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      LikesController,
    ) as unknown[];
    expect(guards).toBeDefined();
    expect(guards.some((g: unknown) => g === ThrottlerGuard)).toBe(true);
  });

  it('should have throttle metadata on likePost', () => {
    const metadata = Reflect.getMetadata(
      'THROTTLER:LIMITdefault',
      LikesController.prototype.likePost,
    ) as unknown;
    expect(metadata).toBeDefined();
  });

  it('should have throttle metadata on unlikePost', () => {
    const metadata = Reflect.getMetadata(
      'THROTTLER:LIMITdefault',
      LikesController.prototype.unlikePost,
    ) as unknown;
    expect(metadata).toBeDefined();
  });

  it('GET endpoints do not have per-route throttle metadata', () => {
    const countMeta = Reflect.getMetadata(
      'THROTTLER:LIMITdefault',
      LikesController.prototype.getLikesCount,
    ) as unknown;
    const statusMeta = Reflect.getMetadata(
      'THROTTLER:LIMITdefault',
      LikesController.prototype.getLikeStatus,
    ) as unknown;
    expect(countMeta).toBeUndefined();
    expect(statusMeta).toBeUndefined();
  });

  it('write endpoints delegate to service when within rate limit', async () => {
    const user = { userId: 'u1' };
    await controller.likePost('post-1', user);
    expect(mockLikesService.addLike).toHaveBeenCalledWith('post-1', 'u1');

    await controller.unlikePost('post-1', user);
    expect(mockLikesService.removeLike).toHaveBeenCalledWith('post-1', 'u1');
  });
});
