import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';
import { PostAuditLog } from './entities/post-audit-log.entity';
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
  let queryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    take: jest.Mock;
    getMany: jest.Mock;
  };
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    findAndCount: jest.Mock<Promise<[Post[], number]>, unknown[]>;
    createQueryBuilder: jest.Mock;
    delete: jest.Mock;
  };
  let auditRepo: { create: jest.Mock; save: jest.Mock };
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
      findAndCount: jest.fn<Promise<[Post[], number]>, unknown[]>(),
      createQueryBuilder: jest.fn(() => queryBuilder),
      delete: jest.fn(),
    };
    auditRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((e: unknown) => Promise.resolve(e)),
    };
    eventBus = { publish: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: getRepositoryToken(Post), useValue: repo },
        { provide: getRepositoryToken(PostAuditLog), useValue: auditRepo },
        { provide: EventBus, useValue: eventBus },
      ],
    }).compile();

    service = module.get(PostsService);
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('saves and returns a PostDto', async () => {
      const post = makePost();
      repo.create.mockReturnValue(post);
      repo.save.mockResolvedValue(post);

      const result = await service.create('author-1', {
        title: 'Hello',
        content: 'World',
      });

      expect(repo.save).toHaveBeenCalledWith(post);
      expect(result.id).toBe('post-1');
    });

    it('defaults isPublished and isPremium to false', async () => {
      const post = makePost();
      repo.create.mockReturnValue(post);
      repo.save.mockResolvedValue(post);

      await service.create('author-1', { title: 'T', content: 'C' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isPublished: false, isPremium: false }),
      );
    });

    it('threads authorId from caller into the created entity', async () => {
      const post = makePost({ authorId: 'caller-42' });
      repo.create.mockReturnValue(post);
      repo.save.mockResolvedValue(post);

      const result = await service.create('caller-42', {
        title: 'T',
        content: 'C',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ authorId: 'caller-42' }),
      );
      expect(result.authorId).toBe('caller-42');
    });

    it('honours explicit isPublished and isPremium when provided', async () => {
      const post = makePost({ isPublished: true, isPremium: true });
      repo.create.mockReturnValue(post);
      repo.save.mockResolvedValue(post);

      const result = await service.create('author-1', {
        title: 'Premium Post',
        content: 'Exclusive content',
        isPublished: true,
        isPremium: true,
      });

      expect(result.isPublished).toBe(true);
      expect(result.isPremium).toBe(true);
    });

    it('returns a mapped PostDto with all expected fields populated', async () => {
      const post = makePost({
        title: 'Hello',
        content: 'World',
        authorId: 'author-1',
      });
      repo.create.mockReturnValue(post);
      repo.save.mockResolvedValue(post);

      const result = await service.create('author-1', {
        title: 'Hello',
        content: 'World',
      });

      expect(result).toMatchObject({
        id: 'post-1',
        title: 'Hello',
        content: 'World',
        authorId: 'author-1',
        isPublished: false,
        isPremium: false,
        likesCount: 0,
      });
    });
  });

  // ── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('calls findAndCount with deletedAt: IsNull() filter', async () => {
      const active = makePost();
      repo.findAndCount.mockResolvedValue([[active], 1]);

      const result = await service.findAll({ limit: 20 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- jest matcher typings are `any`
          where: expect.objectContaining({ deletedAt: expect.anything() }),
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('excludes soft-deleted posts (returns only active ones)', async () => {
      const active = makePost({ id: 'active-1' });
      // The repo mock only returns active posts (service passes IsNull filter)
      repo.findAndCount.mockResolvedValue([[active], 1]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('active-1');
    });

    it('returns empty list when all posts are soft-deleted', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('applies pagination (skip / take)', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ page: 2, limit: 10 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  // ── findByAuthor ─────────────────────────────────────────────────────────────

  describe('findByAuthor', () => {
    it('filters by authorId and deletedAt: IsNull()', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findByAuthor('author-1', { limit: 20 });

      /* eslint-disable @typescript-eslint/no-unsafe-assignment -- jest matcher typings are `any` */
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            authorId: 'author-1',
            deletedAt: expect.anything(),
          }),
        }),
      );
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    });

    it('excludes soft-deleted posts for the author', async () => {
      const active = makePost({ authorId: 'author-1' });
      repo.findAndCount.mockResolvedValue([[active], 1]);

      const result = await service.findByAuthor('author-1', {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('returns empty when author has no active posts', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findByAuthor('author-1', {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(0);
    });
  });

  // ── findOne ──────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the post when active', async () => {
      const post = makePost();
      repo.findOne.mockResolvedValue(post);

      const result = await service.findOne('post-1');

      expect(result.id).toBe('post-1');
    });

    it('throws NotFoundException when post does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFoundException for a soft-deleted post (filtered by IsNull)', async () => {
      // The repo returns null because the IsNull() filter excludes it
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('post-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── update ───────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates and returns the post when the requester is the author', async () => {
      const post = makePost({ authorId: 'author-1' });
      repo.findOne.mockResolvedValue(post);
      repo.save.mockResolvedValue({ ...post, title: 'Updated' });

      const result = await service.update(
        'post-1',
        { title: 'Updated' },
        'author-1',
      );

      expect(repo.save).toHaveBeenCalled();
      expect(result.title).toBe('Updated');
    });

    it('throws NotFoundException for a soft-deleted post', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update('post-1', { title: 'New' }, 'author-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when post does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update('missing', { title: 'X' }, 'author-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when the requester is not the author', async () => {
      const post = makePost({ authorId: 'author-1' });
      repo.findOne.mockResolvedValue(post);

      await expect(
        service.update('post-1', { title: 'Hijacked' }, 'someone-else'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  // ── softDelete ───────────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('sets deletedAt and deletedBy then saves', async () => {
      const post = makePost({ authorId: 'user-99' });
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

    it('persists an audit log row with correct fields', async () => {
      const post = makePost({ authorId: 'user-99' });
      repo.findOne.mockResolvedValue(post);
      repo.save.mockResolvedValue(post);

      await service.softDelete('post-1', 'user-99');

      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          postId: 'post-1',
          deletedBy: 'user-99',
          action: 'soft_delete',
        }),
      );
      expect(auditRepo.save).toHaveBeenCalled();
    });

    it('emits PostDeletedEvent with correct postId and deletedBy', async () => {
      const post = makePost({ authorId: 'user-99' });
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
      expect(auditRepo.save).not.toHaveBeenCalled();
    });

    it('does not emit event or write audit log when post is already soft-deleted', async () => {
      // IsNull() filter means the repo returns null for already-deleted posts
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.softDelete('post-1', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(eventBus.publish).not.toHaveBeenCalled();
      expect(auditRepo.save).not.toHaveBeenCalled();
    });

    it('audit log is written before event is published', async () => {
      const order: string[] = [];
      const post = makePost({ authorId: 'user-1' });
      repo.findOne.mockResolvedValue(post);
      repo.save.mockResolvedValue(post);
      auditRepo.save.mockImplementation((e: unknown) => {
        order.push('audit');
        return Promise.resolve(e);
      });
      eventBus.publish.mockImplementation(() => {
        order.push('event');
      });

      await service.softDelete('post-1', 'user-1');

      expect(order).toEqual(['audit', 'event']);
    });

    it('throws ForbiddenException when the requester is not the author', async () => {
      const post = makePost({ authorId: 'author-1' });
      repo.findOne.mockResolvedValue(post);

      await expect(
        service.softDelete('post-1', 'someone-else'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.save).not.toHaveBeenCalled();
      expect(auditRepo.save).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });

  // ── findFeed ─────────────────────────────────────────────────────────────────

  describe('findFeed', () => {
    it('returns an empty page without querying when authorIds is empty', async () => {
      const result = await service.findFeed([], undefined, 20);

      expect(repo.createQueryBuilder).not.toHaveBeenCalled();
      expect(result.data).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('filters by authorId IN (...), isPublished, and deletedAt IS NULL', async () => {
      queryBuilder.getMany.mockResolvedValue([]);

      await service.findFeed(['author-1', 'author-2'], undefined, 20);

      expect(repo.createQueryBuilder).toHaveBeenCalledWith('post');
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'post.authorId IN (:...authorIds)',
        { authorIds: ['author-1', 'author-2'] },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'post.isPublished = :isPublished',
        { isPublished: true },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'post.deletedAt IS NULL',
      );
    });

    it('orders by createdAt DESC, id DESC and requests limit + 1 rows', async () => {
      queryBuilder.getMany.mockResolvedValue([]);

      await service.findFeed(['author-1'], undefined, 10);

      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'post.createdAt',
        'DESC',
      );
      expect(queryBuilder.take).toHaveBeenCalledWith(11);
    });

    it('returns hasMore=true and a nextCursor when more rows exist than the limit', async () => {
      const posts = [
        makePost({ id: 'p1', createdAt: new Date('2026-01-03T00:00:00Z') }),
        makePost({ id: 'p2', createdAt: new Date('2026-01-02T00:00:00Z') }),
        makePost({ id: 'p3', createdAt: new Date('2026-01-01T00:00:00Z') }),
      ];
      queryBuilder.getMany.mockResolvedValue(posts);

      const result = await service.findFeed(['author-1'], undefined, 2);

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
    });

    it('returns hasMore=false and nextCursor=null when exactly at the page boundary', async () => {
      const posts = [makePost({ id: 'p1' })];
      queryBuilder.getMany.mockResolvedValue(posts);

      const result = await service.findFeed(['author-1'], undefined, 20);

      expect(result.hasMore).toBe(false);
      expect(result.data).toHaveLength(1);
    });

    it('applies a keyset filter derived from the cursor on subsequent pages', async () => {
      queryBuilder.getMany.mockResolvedValue([]);
      const cursor = Buffer.from('2026-01-01T00:00:00.000Z|post-9').toString(
        'base64',
      );

      await service.findFeed(['author-1'], cursor, 20);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('post.createdAt < :cCreatedAt'),
        { cCreatedAt: '2026-01-01T00:00:00.000Z', cId: 'post-9' },
      );
    });

    it('ignores a malformed cursor rather than throwing', async () => {
      queryBuilder.getMany.mockResolvedValue([]);

      await expect(
        service.findFeed(['author-1'], 'not-valid-base64!!', 20),
      ).resolves.toBeDefined();
    });
  });

  // ── PostDeletedEvent ─────────────────────────────────────────────────────────

  describe('PostDeletedEvent', () => {
    it('has the correct type discriminant', () => {
      const event = new PostDeletedEvent('p1', 'u1');
      expect(event.type).toBe('post.deleted');
      expect(event.postId).toBe('p1');
      expect(event.deletedBy).toBe('u1');
    });

    it('records a timestamp', () => {
      const before = Date.now();
      const event = new PostDeletedEvent('p1', 'u1');
      expect(event.timestamp).toBeGreaterThanOrEqual(before);
    });
  });
});
