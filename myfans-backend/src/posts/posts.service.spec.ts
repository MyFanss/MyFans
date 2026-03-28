import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';
import { Post, PostType } from './entities/post.entity';
import { Creator } from '../creators/entities/creator.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { AuditLog, AuditAction } from '../audit-log/entities/audit-log.entity';

const CREATOR_USER_ID = 'user-uuid-1';
const OTHER_USER_ID = 'user-uuid-2';
const POST_ID = 'post-uuid-1';

const mockCreator = { id: 'creator-uuid-1', user_id: CREATOR_USER_ID } as Creator;

const mockPost = {
  id: POST_ID,
  creator: mockCreator,
  title: 'Test Post',
  body: 'Body',
  type: PostType.FREE,
  price: null,
  media_urls: [],
  published_at: new Date(),
  deleted_at: null,
  deleted_by: null,
} as Post;

const makePostRepo = (post: Post | null = mockPost) => ({
  createQueryBuilder: jest.fn(),
  findOne: jest.fn().mockResolvedValue(post),
  create: jest.fn((dto) => ({ ...dto })),
  save: jest.fn().mockImplementation(async (e) => e),
  softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
  remove: jest.fn(),
});

const makeAuditRepo = () => ({
  create: jest.fn((dto) => ({ ...dto })),
  save: jest.fn().mockResolvedValue({}),
});

const makeCreatorRepo = () => ({
  findOne: jest.fn().mockResolvedValue(mockCreator),
});

const makeSubscriptionRepo = () => ({
  findOne: jest.fn().mockResolvedValue(null),
});

const makeCacheManager = () => ({
  reset: jest.fn(),
});

async function buildService(overrides: {
  postRepo?: Partial<ReturnType<typeof makePostRepo>>;
  auditRepo?: Partial<ReturnType<typeof makeAuditRepo>>;
} = {}) {
  const postRepo = { ...makePostRepo(), ...overrides.postRepo };
  const auditRepo = { ...makeAuditRepo(), ...overrides.auditRepo };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PostsService,
      { provide: getRepositoryToken(Post), useValue: postRepo },
      { provide: getRepositoryToken(Creator), useValue: makeCreatorRepo() },
      { provide: getRepositoryToken(Subscription), useValue: makeSubscriptionRepo() },
      { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
      { provide: CACHE_MANAGER, useValue: makeCacheManager() },
    ],
  }).compile();

  return {
    service: module.get<PostsService>(PostsService),
    postRepo,
    auditRepo,
  };
}

describe('PostsService', () => {
  describe('delete', () => {
    it('soft deletes a post and writes an audit log entry', async () => {
      const { service, postRepo, auditRepo } = await buildService();

      const result = await service.delete(POST_ID, CREATOR_USER_ID);

      expect(postRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_by: CREATOR_USER_ID }),
      );
      expect(postRepo.softDelete).toHaveBeenCalledWith(POST_ID);
      expect(auditRepo.save).toHaveBeenCalled();
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_type: 'post',
          entity_id: POST_ID,
          action: AuditAction.DELETE,
          performed_by: CREATOR_USER_ID,
        }),
      );
      expect(result).toEqual({ success: true });
    });

    it('throws ForbiddenException when non-creator tries to delete', async () => {
      const { service } = await buildService();

      await expect(service.delete(POST_ID, OTHER_USER_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException for a non-existent post', async () => {
      const { service } = await buildService({
        postRepo: { findOne: jest.fn().mockResolvedValue(null) },
      });

      await expect(service.delete(POST_ID, CREATOR_USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for a soft-deleted post', async () => {
      const deletedPost = { ...mockPost, deleted_at: new Date() };
      const { service } = await buildService({
        postRepo: { findOne: jest.fn().mockResolvedValue(deletedPost) },
      });

      await expect(service.delete(POST_ID, CREATOR_USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for a soft-deleted post', async () => {
      const deletedPost = { ...mockPost, deleted_at: new Date() };
      const { service } = await buildService({
        postRepo: { findOne: jest.fn().mockResolvedValue(deletedPost) },
      });

      await expect(service.findOne(POST_ID, CREATOR_USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
