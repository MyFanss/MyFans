/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { LikesController } from '../src/likes/likes.controller';
import { LikesService } from '../src/likes/likes.service';
import { Like } from '../src/likes/entities/like.entity';
import { JwtAuthGuard } from '../src/auth-module/guards/jwt-auth.guard';
import { PostsService } from '../src/posts/posts.service';

const TEST_USER_ID = 'e2e-user-id';
const TEST_POST_ID = 'e2e-post-id';

const mockPost = {
  id: TEST_POST_ID,
  authorId: 'e2e-author-id',
  isPremium: false,
  title: 'E2E Test Post',
  content: 'E2E content',
  isPublished: true,
  likesCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

function makeLike(overrides: Partial<Like> = {}): Like {
  return {
    id: `like-${Date.now()}-${Math.random()}`,
    userId: TEST_USER_ID,
    postId: TEST_POST_ID,
    createdAt: new Date(),
    user: undefined as never,
    post: undefined as never,
    ...overrides,
  };
}

describe('LikesController (e2e) – primary endpoints', () => {
  let app: INestApplication;
  let storedLikes: Like[];

  const mockLikeRepo = {
    findOne: jest.fn(async ({ where }: { where: Partial<Like> }) =>
      storedLikes.find(
        (l) =>
          (!where.userId || l.userId === where.userId) &&
          (!where.postId || l.postId === where.postId),
      ) ?? null,
    ),
    create: jest.fn((data: Partial<Like>) => makeLike(data)),
    save: jest.fn(async (like: Like) => {
      storedLikes.push(like);
      return like;
    }),
    remove: jest.fn(async (like: Like) => {
      storedLikes = storedLikes.filter((l) => l.id !== like.id);
    }),
    count: jest.fn(async ({ where }: { where: Partial<Like> }) =>
      storedLikes.filter((l) => !where?.postId || l.postId === where.postId)
        .length,
    ),
    findAndCount: jest.fn(
      async ({
        where,
        skip = 0,
        take = 20,
      }: {
        where?: Partial<Like>;
        skip?: number;
        take?: number;
      }) => {
        const filtered = storedLikes.filter(
          (l) => !where?.postId || l.postId === where.postId,
        );
        return [filtered.slice(skip, skip + take), filtered.length];
      },
    ),
  };

  const mockPostsService = {
    findOne: jest.fn(async () => mockPost),
  };

  const mockJwtAuthGuard = {
    canActivate: (context: ExecutionContext) => {
      const req = context
        .switchToHttp()
        .getRequest<{ user: { userId: string } }>();
      req.user = { userId: TEST_USER_ID };
      return true;
    },
  };

  beforeEach(async () => {
    storedLikes = [];
    jest.clearAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [LikesController],
      providers: [
        LikesService,
        { provide: getRepositoryToken(Like), useValue: mockLikeRepo },
        { provide: PostsService, useValue: mockPostsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // ── POST /v1/posts/:id/like (primary endpoint) ──────────────────────────────

  describe('POST /v1/posts/:id/like', () => {
    it('returns 201 and liked=true when a new like is created', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/posts/${TEST_POST_ID}/like`)
        .expect(201);

      expect(res.body.liked).toBe(true);
      expect(res.body.postId).toBe(TEST_POST_ID);
      expect(res.body.message).toBe('Like added successfully');
    });

    it('returns 200 when the user has already liked the post (idempotent)', async () => {
      await request(app.getHttpServer())
        .post(`/v1/posts/${TEST_POST_ID}/like`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/v1/posts/${TEST_POST_ID}/like`)
        .expect(200);

      expect(res.body.liked).toBe(true);
      expect(res.body.message).toBe('Post already liked');
    });

    it('returns 404 when the post does not exist', async () => {
      mockPostsService.findOne.mockRejectedValueOnce(
        Object.assign(new Error('Post not found'), { status: 404 }),
      );

      await request(app.getHttpServer())
        .post('/v1/posts/nonexistent/like')
        .expect(404);
    });
  });

  // ── DELETE /v1/posts/:id/like ────────────────────────────────────────────────

  describe('DELETE /v1/posts/:id/like', () => {
    it('returns 204 after successfully removing a like', async () => {
      storedLikes.push(makeLike({ userId: TEST_USER_ID, postId: TEST_POST_ID }));

      await request(app.getHttpServer())
        .delete(`/v1/posts/${TEST_POST_ID}/like`)
        .expect(204);
    });

    it('returns 404 when trying to remove a like that does not exist', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/posts/${TEST_POST_ID}/like`)
        .expect(404);
    });
  });

  // ── GET /v1/posts/:id/likes (paginated) ─────────────────────────────────────

  describe('GET /v1/posts/:id/likes', () => {
    it('returns 200 with paginated response shape', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/posts/${TEST_POST_ID}/likes`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('limit');
      expect(res.body).toHaveProperty('hasMore');
    });

    it('returns empty data when no likes exist', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/posts/${TEST_POST_ID}/likes`)
        .expect(200);

      expect(res.body.data).toHaveLength(0);
      expect(res.body.total).toBe(0);
      expect(res.body.hasMore).toBe(false);
    });

    it('respects limit query parameter', async () => {
      for (let i = 0; i < 5; i++) {
        storedLikes.push(
          makeLike({
            id: `like-${i}`,
            userId: `user-${i}`,
            postId: TEST_POST_ID,
          }),
        );
      }

      const res = await request(app.getHttpServer())
        .get(`/v1/posts/${TEST_POST_ID}/likes`)
        .query({ limit: 3 })
        .expect(200);

      expect(res.body.data).toHaveLength(3);
      expect(res.body.limit).toBe(3);
      expect(res.body.hasMore).toBe(true);
    });

    it('returns 400 when limit exceeds 100', async () => {
      await request(app.getHttpServer())
        .get(`/v1/posts/${TEST_POST_ID}/likes`)
        .query({ limit: 101 })
        .expect(400);
    });

    it('returns 400 when page is less than 1', async () => {
      await request(app.getHttpServer())
        .get(`/v1/posts/${TEST_POST_ID}/likes`)
        .query({ page: 0 })
        .expect(400);
    });
  });

  // ── GET /v1/posts/:id/likes/count ────────────────────────────────────────────

  describe('GET /v1/posts/:id/likes/count', () => {
    it('returns 200 with count=0 when no likes exist', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/posts/${TEST_POST_ID}/likes/count`)
        .expect(200);

      expect(res.body).toHaveProperty('count', 0);
    });

    it('returns the correct count after likes are added', async () => {
      storedLikes.push(
        makeLike({ id: 'like-a', userId: 'user-a', postId: TEST_POST_ID }),
        makeLike({ id: 'like-b', userId: 'user-b', postId: TEST_POST_ID }),
      );

      const res = await request(app.getHttpServer())
        .get(`/v1/posts/${TEST_POST_ID}/likes/count`)
        .expect(200);

      expect(res.body.count).toBe(2);
    });
  });

  // ── GET /v1/posts/:id/like/status ────────────────────────────────────────────

  describe('GET /v1/posts/:id/like/status', () => {
    it('returns liked=false when user has not liked the post', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/posts/${TEST_POST_ID}/like/status`)
        .expect(200);

      expect(res.body).toHaveProperty('liked', false);
    });

    it('returns liked=true when user has liked the post', async () => {
      storedLikes.push(makeLike({ userId: TEST_USER_ID, postId: TEST_POST_ID }));

      const res = await request(app.getHttpServer())
        .get(`/v1/posts/${TEST_POST_ID}/like/status`)
        .expect(200);

      expect(res.body.liked).toBe(true);
    });
  });
});
