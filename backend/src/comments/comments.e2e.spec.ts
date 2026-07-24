import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import * as request from 'supertest';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { CommentDto } from './dto';
import { PaginatedResponseDto } from '../common/dto';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';

const VALID_UUID = '00000000-0000-4000-8000-000000000001';
const PARENT_UUID = '00000000-0000-4000-8000-000000000002';

const makeCommentDto = (overrides: Partial<CommentDto> = {}): CommentDto =>
  ({
    id: 'comment-1',
    content: 'Great post!',
    authorId: 'jwt-user-1',
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
      providers: [
        { provide: CommentsService, useValue: mockService },
        { provide: JwtAuthGuard, useValue: { canActivate: jest.fn().mockReturnValue(true) } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(() => app.close());
  afterEach(() => jest.clearAllMocks());

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
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveLength(0);
    });
  });

  describe('GET /v1/comments/post/:postId', () => {
    it('returns 200 with paginated comments for a valid post', async () => {
      mockService.findByPost.mockResolvedValue(
        makePaginated([makeCommentDto()], { total: 1 }),
      );

      const { status, body } = await request(app.getHttpServer()).get(
        `/v1/comments/post/${VALID_UUID}`,
      );

      expect(status).toBe(200);
      expect(body.data).toHaveLength(1);
    });

    it('returns 200 with empty list when post has no comments', async () => {
      mockService.findByPost.mockResolvedValue(makePaginated([]));

      const { status, body } = await request(app.getHttpServer()).get(
        `/v1/comments/post/${VALID_UUID}`,
      );

      expect(status).toBe(200);
      expect(body.data).toHaveLength(0);
    });
  });

  describe('GET /v1/comments/:id', () => {
    it('returns 200 with comment details', async () => {
      mockService.findOne.mockResolvedValue(makeCommentDto());

      const { status, body } = await request(app.getHttpServer()).get(
        '/v1/comments/comment-1',
      );

      expect(status).toBe(200);
      expect(body.id).toBe('comment-1');
      expect(body.content).toBe('Great post!');
    });

    it('returns 404 when comment does not exist', async () => {
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

  describe('POST /v1/comments', () => {
    it('returns 201 with the created comment', async () => {
      mockService.create.mockResolvedValue(makeCommentDto());

      const { status, body } = await request(app.getHttpServer())
        .post('/v1/comments')
        .send({ content: 'Great post!', postId: VALID_UUID });

      expect(status).toBe(201);
      expect(body.content).toBe('Great post!');
    });

    it('returns 400 when content is missing', async () => {
      const { status } = await request(app.getHttpServer())
        .post('/v1/comments')
        .send({});

      expect(status).toBe(400);
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
        'jwt-user-1',
        expect.not.objectContaining({ unknownField: expect.anything() }),
      );
    });
  });

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
