import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';

const makeComment = (overrides: Partial<Comment> = {}): Comment =>
  ({
    id: 'comment-1',
    content: 'Great post!',
    authorId: 'author-1',
    postId: 'post-1',
    parentId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
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
  };

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: repo },
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
        expect.objectContaining({ content: 'Great post!', postId: 'post-1', authorId: 'author-1' }),
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
    it('returns comments filtered by postId', async () => {
      const comment = makeComment({ postId: 'post-42' });
      repo.findAndCount.mockResolvedValue([[comment], 1]);

      const result = await service.findByPost('post-42', { page: 1, limit: 20 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { postId: 'post-42' } }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].postId).toBe('post-42');
    });

    it('returns empty list when the post has no comments', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findByPost('post-empty', { page: 1, limit: 20 });

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

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'comment-1' } });
      expect(result.id).toBe('comment-1');
      expect(result.content).toBe('Great post!');
    });

    it('throws NotFoundException when comment does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException with the comment id in the message', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toThrow('missing-id');
    });
  });

  // ── update ───────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates the content and returns the updated CommentDto', async () => {
      const comment = makeComment();
      repo.findOne.mockResolvedValue(comment);
      repo.save.mockResolvedValue({ ...comment, content: 'Updated content' });

      const result = await service.update('comment-1', { content: 'Updated content' });

      expect(repo.save).toHaveBeenCalled();
      expect(result.content).toBe('Updated content');
    });

    it('calls findOne with the correct id', async () => {
      const comment = makeComment();
      repo.findOne.mockResolvedValue(comment);
      repo.save.mockResolvedValue(comment);

      await service.update('comment-1', { content: 'New content' });

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'comment-1' } });
    });

    it('throws NotFoundException when comment does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update('missing', { content: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('does not call save when comment is not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update('missing', { content: 'X' })).rejects.toThrow();

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('merges partial updates without overwriting unchanged fields', async () => {
      const comment = makeComment({ content: 'Original', postId: 'post-1' });
      repo.findOne.mockResolvedValue(comment);
      repo.save.mockResolvedValue({ ...comment, content: 'Updated' });

      const result = await service.update('comment-1', { content: 'Updated' });

      expect(result.postId).toBe('post-1');
    });
  });

  // ── remove ───────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('removes the comment when it exists', async () => {
      const comment = makeComment();
      repo.findOne.mockResolvedValue(comment);
      repo.remove.mockResolvedValue(undefined);

      await service.remove('comment-1');

      expect(repo.remove).toHaveBeenCalledWith(comment);
    });

    it('returns void on success', async () => {
      const comment = makeComment();
      repo.findOne.mockResolvedValue(comment);
      repo.remove.mockResolvedValue(undefined);

      const result = await service.remove('comment-1');

      expect(result).toBeUndefined();
    });

    it('throws NotFoundException when comment does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('does not call remove when comment is not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow();

      expect(repo.remove).not.toHaveBeenCalled();
    });
  });
});
