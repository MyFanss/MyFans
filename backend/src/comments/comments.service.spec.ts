import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';
import { CommentAuditLog } from './entities/comment-audit-log.entity';
import { EventBus } from '../events/event-bus';
import { CommentDeletedEvent } from '../events/domain-events';

const makeComment = (overrides: Partial<Comment> = {}): Comment =>
  ({
    id: 'comment-1',
    content: 'Great post!',
    authorId: 'author-1',
    postId: 'post-1',
    parentId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  }) as Comment;

describe('CommentsService', () => {
  let service: CommentsService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    findAndCount: jest.Mock;
    remove: jest.Mock;
    delete: jest.Mock;
  };
  let auditRepo: { create: jest.Mock; save: jest.Mock };
  let eventBus: { publish: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      remove: jest.fn(),
      delete: jest.fn(),
    };
    auditRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((e: unknown) => Promise.resolve(e)),
    };
    eventBus = { publish: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: repo },
        { provide: getRepositoryToken(CommentAuditLog), useValue: auditRepo },
        { provide: EventBus, useValue: eventBus },
      ],
    }).compile();

    service = module.get(CommentsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('saves and returns a CommentDto', async () => {
      const comment = makeComment();
      repo.create.mockReturnValue(comment);
      repo.save.mockResolvedValue(comment);

      const result = await service.create('author-1', {
        content: 'Great post!',
        postId: 'post-1',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Great post!',
          postId: 'post-1',
          authorId: 'author-1',
        }),
      );
      expect(repo.save).toHaveBeenCalledWith(comment);
      expect(result.id).toBe('comment-1');
      expect(result.content).toBe('Great post!');
    });

    it('persists authorId from caller, not from DTO', async () => {
      const comment = makeComment({ authorId: 'caller-99' });
      repo.create.mockReturnValue(comment);
      repo.save.mockResolvedValue(comment);

      const result = await service.create('caller-99', {
        content: 'Hi',
        postId: 'post-1',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ authorId: 'caller-99' }),
      );
      expect(result.authorId).toBe('caller-99');
    });

    it('stores optional parentId when provided', async () => {
      const comment = makeComment({ parentId: 'parent-comment-1' });
      repo.create.mockReturnValue(comment);
      repo.save.mockResolvedValue(comment);

      const result = await service.create('author-1', {
        content: 'Reply',
        postId: 'post-1',
        parentId: 'parent-comment-1',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: 'parent-comment-1' }),
      );
      expect(result.parentId).toBe('parent-comment-1');
    });

    it('returns a mapped CommentDto (not the raw entity)', async () => {
      const comment = makeComment();
      repo.create.mockReturnValue(comment);
      repo.save.mockResolvedValue(comment);

      const result = await service.create('author-1', {
        content: 'Hello',
        postId: 'post-1',
      });

      // CommentDto should expose only documented fields
      expect(result).toMatchObject({
        id: 'comment-1',
        content: 'Great post!',
        authorId: 'author-1',
        postId: 'post-1',
      });
    });
  });

  // ── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns a paginated list of comments', async () => {
      const comment = makeComment();
      repo.findAndCount.mockResolvedValue([[comment], 1]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('filters by deletedAt: IsNull()', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ page: 1, limit: 20 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- jest matcher typings are `any`
          where: expect.objectContaining({ deletedAt: expect.anything() }),
        }),
      );
    });

    it('returns empty list when there are no comments', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('applies correct pagination skip/take for page 2', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ page: 2, limit: 10 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('orders by createdAt DESC', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ page: 1, limit: 20 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { createdAt: 'DESC' } }),
      );
    });

    it('uses defaults (page=1, limit=20) when not provided', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({});

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });
  });

  // ── findByPost ───────────────────────────────────────────────────────────────

  describe('findByPost', () => {
    it('returns comments filtered by postId and deletedAt: IsNull()', async () => {
      const comment = makeComment({ postId: 'post-42' });
      repo.findAndCount.mockResolvedValue([[comment], 1]);

      const result = await service.findByPost('post-42', {
        page: 1,
        limit: 20,
      });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            postId: 'post-42',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- jest matcher typings are `any`
            deletedAt: expect.anything(),
          }),
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].postId).toBe('post-42');
    });

    it('returns empty list when the post has no comments', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findByPost('post-empty', {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('applies correct pagination skip/take', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findByPost('post-1', { page: 3, limit: 5 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });

    it('orders by createdAt DESC', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findByPost('post-1', { page: 1, limit: 20 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { createdAt: 'DESC' } }),
      );
    });
  });

  // ── findOne ──────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the comment when it exists', async () => {
      const comment = makeComment();
      repo.findOne.mockResolvedValue(comment);

      const result = await service.findOne('comment-1');

      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'comment-1' }),
        }),
      );
      expect(result.id).toBe('comment-1');
      expect(result.content).toBe('Great post!');
    });

    it('throws NotFoundException when comment does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFoundException with the comment id in the message', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toThrow('missing-id');
    });

    it('throws NotFoundException for a soft-deleted comment (filtered by IsNull)', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('comment-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── update ───────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates the content and returns the updated CommentDto', async () => {
      const comment = makeComment();
      repo.findOne.mockResolvedValue(comment);
      repo.save.mockResolvedValue({ ...comment, content: 'Updated content' });

      const result = await service.update(
        'comment-1',
        { content: 'Updated content' },
        'author-1',
      );

      expect(repo.save).toHaveBeenCalled();
      expect(result.content).toBe('Updated content');
    });

    it('calls findOne with the correct id', async () => {
      const comment = makeComment();
      repo.findOne.mockResolvedValue(comment);
      repo.save.mockResolvedValue(comment);

      await service.update('comment-1', { content: 'New content' }, 'author-1');

      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'comment-1' }),
        }),
      );
    });

    it('throws NotFoundException when comment does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update('missing', { content: 'X' }, 'author-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('does not call save when comment is not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update('missing', { content: 'X' }, 'author-1'),
      ).rejects.toThrow();

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('merges partial updates without overwriting unchanged fields', async () => {
      const comment = makeComment({ content: 'Original', postId: 'post-1' });
      repo.findOne.mockResolvedValue(comment);
      repo.save.mockResolvedValue({ ...comment, content: 'Updated' });

      const result = await service.update(
        'comment-1',
        { content: 'Updated' },
        'author-1',
      );

      expect(result.postId).toBe('post-1');
    });

    it('throws ForbiddenException when the requester is not the author', async () => {
      const comment = makeComment({ authorId: 'author-1' });
      repo.findOne.mockResolvedValue(comment);

      await expect(
        service.update('comment-1', { content: 'Hijacked' }, 'someone-else'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  // ── remove (soft delete) ─────────────────────────────────────────────────────

  describe('remove', () => {
    it('sets deletedAt and deletedBy then saves', async () => {
      const comment = makeComment({ authorId: 'author-1' });
      repo.findOne.mockResolvedValue(comment);
      repo.save.mockResolvedValue({
        ...comment,
        deletedAt: new Date(),
        deletedBy: 'author-1',
      });

      await service.remove('comment-1', 'author-1');

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ deletedBy: 'author-1' }),
      );
      expect(comment.deletedAt).not.toBeNull();
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('persists an audit log row with correct fields', async () => {
      const comment = makeComment({ authorId: 'author-1' });
      repo.findOne.mockResolvedValue(comment);
      repo.save.mockResolvedValue(comment);

      await service.remove('comment-1', 'author-1');

      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          commentId: 'comment-1',
          deletedBy: 'author-1',
          action: 'soft_delete',
        }),
      );
      expect(auditRepo.save).toHaveBeenCalled();
    });

    it('emits CommentDeletedEvent with correct commentId and deletedBy', async () => {
      const comment = makeComment({ authorId: 'author-1' });
      repo.findOne.mockResolvedValue(comment);
      repo.save.mockResolvedValue(comment);

      await service.remove('comment-1', 'author-1');

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'comment.deleted',
          commentId: 'comment-1',
          deletedBy: 'author-1',
        }),
      );
    });

    it('returns void on success', async () => {
      const comment = makeComment();
      repo.findOne.mockResolvedValue(comment);
      repo.save.mockResolvedValue(comment);

      const result = await service.remove('comment-1', 'author-1');

      expect(result).toBeUndefined();
    });

    it('throws NotFoundException when comment does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.remove('missing', 'author-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(eventBus.publish).not.toHaveBeenCalled();
      expect(auditRepo.save).not.toHaveBeenCalled();
    });

    it('does not emit event or write audit log when comment is already soft-deleted', async () => {
      // IsNull() filter means the repo returns null for already-deleted comments
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.remove('comment-1', 'author-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(eventBus.publish).not.toHaveBeenCalled();
      expect(auditRepo.save).not.toHaveBeenCalled();
    });

    it('audit log is written before event is published', async () => {
      const order: string[] = [];
      const comment = makeComment({ authorId: 'author-1' });
      repo.findOne.mockResolvedValue(comment);
      repo.save.mockResolvedValue(comment);
      auditRepo.save.mockImplementation((e: unknown) => {
        order.push('audit');
        return Promise.resolve(e);
      });
      eventBus.publish.mockImplementation(() => {
        order.push('event');
      });

      await service.remove('comment-1', 'author-1');

      expect(order).toEqual(['audit', 'event']);
    });

    it('throws ForbiddenException when the requester is not the author', async () => {
      const comment = makeComment({ authorId: 'author-1' });
      repo.findOne.mockResolvedValue(comment);

      await expect(
        service.remove('comment-1', 'someone-else'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.save).not.toHaveBeenCalled();
      expect(auditRepo.save).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
      expect(repo.remove).not.toHaveBeenCalled();
    });
  });

  // ── hardDelete ───────────────────────────────────────────────────────────────

  describe('hardDelete', () => {
    it('is not the default deletion path (hard-deletes only when called explicitly)', async () => {
      repo.delete.mockResolvedValue({ affected: 1 });

      await service.hardDelete('comment-1');

      expect(repo.delete).toHaveBeenCalledWith('comment-1');
    });

    it('throws NotFoundException when nothing was deleted', async () => {
      repo.delete.mockResolvedValue({ affected: 0 });

      await expect(service.hardDelete('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── CommentDeletedEvent ──────────────────────────────────────────────────────

  describe('CommentDeletedEvent', () => {
    it('has the correct type discriminant', () => {
      const event = new CommentDeletedEvent('c1', 'u1');
      expect(event.type).toBe('comment.deleted');
      expect(event.commentId).toBe('c1');
      expect(event.deletedBy).toBe('u1');
    });

    it('records a timestamp', () => {
      const before = Date.now();
      const event = new CommentDeletedEvent('c1', 'u1');
      expect(event.timestamp).toBeGreaterThanOrEqual(before);
    });
  });
});
