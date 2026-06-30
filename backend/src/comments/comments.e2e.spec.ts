import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import * as request from 'supertest';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { CommentDto } from './dto';
import { PaginatedResponseDto } from '../common/dto';

// ── factories ────────────────────────────────────────────────────────────────

const VALID_UUID = '00000000-0000-4000-8000-000000000001';
const PARENT_UUID = '00000000-0000-4000-8000-000000000002';

const makeCommentDto = (overrides: Partial<CommentDto> = {}): CommentDto =>
  ({
    id: 'comment-1',
    content: 'Great post!',
    authorId: 'temp-author-id',
    postId: VALID_UUID,
    parentId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }) as CommentDto;

const makePaginated = (
  data: CommentDto[],
  overrides?: Partial<PaginatedResponseDto<CommentDto>>,
): PaginatedResponseDto<CommentDto> =>
  ({
    data,
    total: data.length,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasMore: false,
    nextCursor: null,
    cursor: null,
    ...overrides,
  }) as PaginatedResponseDto<CommentDto>;

// ── suite ────────────────────────────────────────────────────────────────────

describe('Comments (e2e)', () => {
  let app: INestApplication;
  let mockService: jest.Mocked<
    Pick<
      CommentsService,
      'create' | 'findAll' | 'findByPost' | 'findOne' | 'update' | 'remove'
    >
  >;

  beforeAll(async () => {
    mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findByPost: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }]),
      ],
      controllers: [CommentsController],
      providers: [{ provide: CommentsService, useValue: mockService }],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(() => app.close());
  afterEach(() => jest.clearAllMocks());

  // ── GET /v1/comments ───────────────────────────────────────────────────────

  describe('GET /v1/comments', () => {
    it('returns 200 with a paginated comments list', async () => {
      mockService.findAll.mockResolvedValue(
        makePaginated([makeCommentDto(), makeCommentDto({ id: 'comment-2' })], {
          total: 2,
        }),
      );

      const { status, body } = await request(app.getHttpServer()).get(
        '/v1/comments',
      );

      expect(status).toBe(200);
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('total', 2);
      expect(body).toHaveProperty('page', 1);
      expect(body).toHaveProperty('limit', 20);
      expect(body.data).toHaveLength(2);
    });

    it('returns 200 with an empty list when there are no comments', async () => {
      mockService.findAll.mockResolvedValue(makePaginated([]));

      const { status, body } = await request(app.getHttpServer()).get(
        '/v1/comments',
      );

      expect(status).toBe(200);
      expect(body.data).toHaveLength(0);
      expect(body.total).toBe(0);
    });

    it('respects page and limit query params', async () => {
      mockService.findAll.mockResolvedValue(
        makePaginated([makeCommentDto()], { page: 2, limit: 5, total: 11 }),
      );

      const { status, body } = await request(app.getHttpServer()).get(
        '/v1/comments?page=2&limit=5',
      );

      expect(status).toBe(200);
      expect(mockService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, limit: 5 }),
      );
      expect(body.page).toBe(2);
      expect(body.limit).toBe(5);
    });

    it('returns 400 when page is 0', async () => {
      const { status } = await request(app.getHttpServer()).get(
        '/v1/comments?page=0',
      );
      expect(status).toBe(400);
    });

    it('returns 400 when page is negative', async () => {
      const { status } = await request(app.getHttpServer()).get(
        '/v1/comments?page=-1',
      );
      expect(status).toBe(400);
    });

    it('returns 400 when limit exceeds 100', async () => {
      const { status } = await request(app.getHttpServer()).get(
        '/v1/comments?limit=101',
      );
      expect(status).toBe(400);
    });

    it('returns 400 when limit is 0', async () => {
      const { status } = await request(app.getHttpServer()).get(
        '/v1/comments?limit=0',
      );
      expect(status).toBe(400);
    });

    it('uses defaults (page=1, limit=20) when no params provided', async () => {
      mockService.findAll.mockResolvedValue(makePaginated([]));

      await request(app.getHttpServer()).get('/v1/comments');

      expect(mockService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });
  });

  // ── GET /v1/comments/post/:postId ──────────────────────────────────────────

  describe('GET /v1/comments/post/:postId', () => {
    it('returns 200 with comments for the post', async () => {
      mockService.findByPost.mockResolvedValue(
        makePaginated([makeCommentDto({ postId: VALID_UUID })], { total: 1 }),
      );

      const { status, body } = await request(app.getHttpServer()).get(
        `/v1/comments/post/${VALID_UUID}`,
      );

      expect(status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].postId).toBe(VALID_UUID);
    });

    it('returns 200 with empty list when post has no comments', async () => {
      mockService.findByPost.mockResolvedValue(makePaginated([]));

      const { status, body } = await request(app.getHttpServer()).get(
        `/v1/comments/post/${VALID_UUID}`,
      );

      expect(status).toBe(200);
      expect(body.data).toHaveLength(0);
    });

    it('passes pagination params to service.findByPost', async () => {
      mockService.findByPost.mockResolvedValue(
        makePaginated([], { page: 2, limit: 10 }),
      );

      await request(app.getHttpServer()).get(
        `/v1/comments/post/${VALID_UUID}?page=2&limit=10`,
      );

      expect(mockService.findByPost).toHaveBeenCalledWith(
        VALID_UUID,
        expect.objectContaining({ page: 2, limit: 10 }),
      );
    });
  });

  // ── GET /v1/comments/:id ───────────────────────────────────────────────────

  describe('GET /v1/comments/:id', () => {
    it('returns 200 with the comment when it exists', async () => {
      mockService.findOne.mockResolvedValue(makeCommentDto());

      const { status, body } = await request(app.getHttpServer()).get(
        '/v1/comments/comment-1',
      );

      expect(status).toBe(200);
      expect(body.id).toBe('comment-1');
      expect(body.content).toBe('Great post!');
    });

    it('returns 404 when comment does not exist', async () => {
      mockService.findOne.mockRejectedValue(
        Object.assign(new Error('Not Found'), { status: 404 }),
      );

      // Trigger the NotFoundException path from the service
      const { NotFoundException } = await import('@nestjs/common');
      mockService.findOne.mockRejectedValue(
        new NotFoundException('Comment with id "missing" not found'),
      );

      const { status } = await request(app.getHttpServer()).get(
        '/v1/comments/missing',
      );

      expect(status).toBe(404);
    });
  });

  // ── POST /v1/comments ──────────────────────────────────────────────────────

  describe('POST /v1/comments', () => {
    it('returns 201 with the created comment', async () => {
      const dto = { content: 'Great post!', postId: VALID_UUID };
      mockService.create.mockResolvedValue(makeCommentDto());

      const { status, body } = await request(app.getHttpServer())
        .post('/v1/comments')
        .send(dto);

      expect(status).toBe(201);
      expect(body.id).toBe('comment-1');
      expect(body.content).toBe('Great post!');
    });

    it('returns 201 when parentId is included', async () => {
      const dto = { content: 'Reply!', postId: VALID_UUID, parentId: PARENT_UUID };
      mockService.create.mockResolvedValue(makeCommentDto({ parentId: PARENT_UUID }));

      const { status, body } = await request(app.getHttpServer())
        .post('/v1/comments')
        .send(dto);

      expect(status).toBe(201);
      expect(body.parentId).toBe(PARENT_UUID);
    });

    it('returns 400 when content is missing', async () => {
      const { status, body } = await request(app.getHttpServer())
        .post('/v1/comments')
        .send({ postId: VALID_UUID });

      expect(status).toBe(400);
      expect(body.message).toEqual(expect.arrayContaining([expect.stringMatching(/content/i)]));
    });

    it('returns 400 when postId is missing', async () => {
      const { status, body } = await request(app.getHttpServer())
        .post('/v1/comments')
        .send({ content: 'Hello' });

      expect(status).toBe(400);
      expect(body.message).toEqual(expect.arrayContaining([expect.stringMatching(/postId/i)]));
    });

    it('returns 400 when postId is not a valid UUID', async () => {
      const { status } = await request(app.getHttpServer())
        .post('/v1/comments')
        .send({ content: 'Hello', postId: 'not-a-uuid' });

      expect(status).toBe(400);
    });

    it('returns 400 when content exceeds 2000 characters', async () => {
      const { status } = await request(app.getHttpServer())
        .post('/v1/comments')
        .send({ content: 'a'.repeat(2001), postId: VALID_UUID });

      expect(status).toBe(400);
    });

    it('strips unknown fields (whitelist mode)', async () => {
      mockService.create.mockResolvedValue(makeCommentDto());

      await request(app.getHttpServer())
        .post('/v1/comments')
        .send({ content: 'Hi', postId: VALID_UUID, unknownField: 'should-be-stripped' });

      expect(mockService.create).toHaveBeenCalledWith(
        'temp-author-id',
        expect.not.objectContaining({ unknownField: expect.anything() }),
      );
    });
  });

  // ── PUT /v1/comments/:id ───────────────────────────────────────────────────

  describe('PUT /v1/comments/:id', () => {
    it('returns 200 with the updated comment', async () => {
      mockService.update.mockResolvedValue(makeCommentDto({ content: 'Updated!' }));

      const { status, body } = await request(app.getHttpServer())
        .put('/v1/comments/comment-1')
        .send({ content: 'Updated!' });

      expect(status).toBe(200);
      expect(body.content).toBe('Updated!');
    });

    it('returns 400 when content is empty string', async () => {
      const { status } = await request(app.getHttpServer())
        .put('/v1/comments/comment-1')
        .send({ content: '' });

      expect(status).toBe(400);
    });

    it('returns 400 when content exceeds 2000 characters', async () => {
      const { status } = await request(app.getHttpServer())
        .put('/v1/comments/comment-1')
        .send({ content: 'x'.repeat(2001) });

      expect(status).toBe(400);
    });

    it('returns 404 when comment does not exist', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockService.update.mockRejectedValue(
        new NotFoundException('Comment with id "missing" not found'),
      );

      const { status } = await request(app.getHttpServer())
        .put('/v1/comments/missing')
        .send({ content: 'Updated' });

      expect(status).toBe(404);
    });
  });

  // ── DELETE /v1/comments/:id ────────────────────────────────────────────────

  describe('DELETE /v1/comments/:id', () => {
    it('returns 204 on successful deletion', async () => {
      mockService.remove.mockResolvedValue(undefined);

      const { status } = await request(app.getHttpServer()).delete(
        '/v1/comments/comment-1',
      );

      expect(status).toBe(204);
    });

    it('returns 404 when comment does not exist', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockService.remove.mockRejectedValue(
        new NotFoundException('Comment with id "missing" not found'),
      );

      const { status } = await request(app.getHttpServer()).delete(
        '/v1/comments/missing',
      );

      expect(status).toBe(404);
    });
  });
});
