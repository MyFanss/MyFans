/**
 * End-to-end coverage for the ownership/participant/identity hardening
 * fixes tracked by #1414–#1417:
 *   - Posts & comments: author-only mutation (JwtAuthGuard + service-level
 *     ownership checks).
 *   - Conversations: participant-only reads/writes (already enforced at
 *     the service layer; verified here against the real guard chain).
 *   - Games: join uses the JWT subject, never a caller-supplied body field.
 *   - Analytics: JWT + role RBAC, non-admins scoped to their own creator.
 *
 * These build minimal, DB-free testing modules (real JwtStrategy + signed
 * JWTs, fake TypeORM repositories) rather than the full AppModule, mirroring
 * the existing `test/rbac.e2e-spec.ts` pattern.
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';

import { JwtStrategy } from '../src/auth-module/strategies/jwt.strategy';
import { AuthService } from '../src/auth-module/auth.service';
import { UserRole } from '../src/common/enums/user-role.enum';

import { PostsController } from '../src/posts/posts.controller';
import { PostsService } from '../src/posts/posts.service';
import { Post } from '../src/posts/entities/post.entity';
import { PostAuditLog } from '../src/posts/entities/post-audit-log.entity';
import { EventBus } from '../src/events/event-bus';

import { CommentsController } from '../src/comments/comments.controller';
import { CommentsService } from '../src/comments/comments.service';
import { Comment } from '../src/comments/entities/comment.entity';

import { ConversationsController } from '../src/conversations/conversations.controller';
import { ConversationsService } from '../src/conversations/conversations.service';
import { Conversation } from '../src/conversations/entities/conversation.entity';
import { Message } from '../src/conversations/entities/message.entity';

import { GamesController } from '../src/games/games.controller';
import { GamesService } from '../src/games/games.service';
import { Game, GameStatus } from '../src/games/entities/game.entity';
import { Player } from '../src/games/entities/player.entity';

import { AnalyticsController } from '../src/analytics/analytics.controller';
import { AnalyticsService } from '../src/analytics/analytics.service';
import { SubscriptionsService } from '../src/subscriptions/subscriptions.service';

const JWT_SECRET = 'security-hardening-e2e-secret-not-for-production';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '33333333-3333-4333-8333-333333333333';

const USERS: Record<string, { id: string; email: string; role: UserRole }> = {
  [OWNER_ID]: {
    id: OWNER_ID,
    email: 'owner@myfans.test',
    role: UserRole.CREATOR,
  },
  [OTHER_ID]: {
    id: OTHER_ID,
    email: 'other@myfans.test',
    role: UserRole.CREATOR,
  },
  [ADMIN_ID]: {
    id: ADMIN_ID,
    email: 'admin@myfans.test',
    role: UserRole.ADMIN,
  },
};

function authInfra() {
  return {
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      PassportModule,
      JwtModule.register({
        secret: JWT_SECRET,
        signOptions: { expiresIn: '1h' },
      }),
    ],
    providers: [
      JwtStrategy,
      {
        provide: AuthService,
        useValue: {
          validateUser: jest
            .fn()
            .mockImplementation((id: string) =>
              Promise.resolve(USERS[id] ?? null),
            ),
        },
      },
    ],
  };
}

async function initApp(module: TestingModule): Promise<INestApplication<App>> {
  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  await app.init();
  return app;
}

beforeAll(() => {
  process.env.JWT_SECRET = JWT_SECRET;
});

// ── Posts & comments: author-only mutation (#1414) ───────────────────────

describe('Posts & Comments ownership (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let postRepo: Record<string, jest.Mock>;
  let commentRepo: Record<string, jest.Mock>;

  const bearer = (sub: string) => `Bearer ${jwt.sign({ sub })}`;

  const post = {
    id: 'post-1',
    title: 'Hello',
    content: 'World',
    authorId: OWNER_ID,
    isPublished: false,
    isPremium: false,
    likesCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    deletedBy: null,
  };

  const comment = {
    id: 'comment-1',
    content: 'Nice post',
    authorId: OWNER_ID,
    postId: 'post-1',
    parentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    postRepo = {
      findOne: jest.fn().mockResolvedValue(post),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    };
    commentRepo = {
      findOne: jest.fn().mockResolvedValue(comment),
      save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ...authInfra().imports,
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }]),
      ],
      controllers: [PostsController, CommentsController],
      providers: [
        ...authInfra().providers,
        PostsService,
        CommentsService,
        { provide: getRepositoryToken(Post), useValue: postRepo },
        {
          provide: getRepositoryToken(PostAuditLog),
          useValue: { create: jest.fn((x: unknown) => x), save: jest.fn() },
        },
        {
          provide: EventBus,
          useValue: { publish: jest.fn(), subscribe: jest.fn() },
        },
        { provide: getRepositoryToken(Comment), useValue: commentRepo },
      ],
    }).compile();

    app = await initApp(module);
    jwt = app.get(JwtService);
  });

  afterAll(() => app.close());

  describe('PUT /v1/posts/:id', () => {
    it('rejects an anonymous request with 401', () =>
      request(app.getHttpServer())
        .put('/v1/posts/post-1')
        .send({ title: 'X' })
        .expect(401));

    it('rejects a non-owner with 403', () =>
      request(app.getHttpServer())
        .put('/v1/posts/post-1')
        .set('Authorization', bearer(OTHER_ID))
        .send({ title: 'Hijacked' })
        .expect(403));

    it('allows the owner with 200', () =>
      request(app.getHttpServer())
        .put('/v1/posts/post-1')
        .set('Authorization', bearer(OWNER_ID))
        .send({ title: 'Updated' })
        .expect(200));
  });

  describe('DELETE /v1/posts/:id', () => {
    it('rejects a non-owner with 403', () =>
      request(app.getHttpServer())
        .delete('/v1/posts/post-1')
        .set('Authorization', bearer(OTHER_ID))
        .expect(403));

    it('allows the owner with 204', () =>
      request(app.getHttpServer())
        .delete('/v1/posts/post-1')
        .set('Authorization', bearer(OWNER_ID))
        .expect(204));
  });

  describe('PUT /v1/comments/:id', () => {
    it('rejects an anonymous request with 401', () =>
      request(app.getHttpServer())
        .put('/v1/comments/comment-1')
        .send({ content: 'X' })
        .expect(401));

    it('rejects a non-owner with 403', () =>
      request(app.getHttpServer())
        .put('/v1/comments/comment-1')
        .set('Authorization', bearer(OTHER_ID))
        .send({ content: 'Hijacked' })
        .expect(403));

    it('allows the owner with 200', () =>
      request(app.getHttpServer())
        .put('/v1/comments/comment-1')
        .set('Authorization', bearer(OWNER_ID))
        .send({ content: 'Updated' })
        .expect(200));
  });

  describe('DELETE /v1/comments/:id', () => {
    it('rejects a non-owner with 403', () =>
      request(app.getHttpServer())
        .delete('/v1/comments/comment-1')
        .set('Authorization', bearer(OTHER_ID))
        .expect(403));

    it('allows the owner with 204', () =>
      request(app.getHttpServer())
        .delete('/v1/comments/comment-1')
        .set('Authorization', bearer(OWNER_ID))
        .expect(204));
  });
});

// ── Conversations: participant-only access (#1415) ───────────────────────

describe('Conversations participant scoping (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;

  const bearer = (sub: string) => `Bearer ${jwt.sign({ sub })}`;

  const conversation: Conversation = {
    id: 'conv-1',
    participant1Id: OWNER_ID,
    participant2Id: OTHER_ID,
    lastMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const STRANGER_ID = '44444444-4444-4444-8444-444444444444';
  USERS[STRANGER_ID] = {
    id: STRANGER_ID,
    email: 'stranger@myfans.test',
    role: UserRole.USER,
  };

  interface ConversationWhereClause {
    id?: string;
    participant1Id?: string;
    participant2Id?: string;
  }

  beforeAll(async () => {
    const conversationsRepo: Record<string, jest.Mock> = {
      findOne: jest
        .fn()
        .mockImplementation(
          ({
            where,
          }: {
            where: ConversationWhereClause | ConversationWhereClause[];
          }) => {
            const clauses = Array.isArray(where) ? where : [where];
            const match = clauses.some(
              (c) =>
                c.id === conversation.id &&
                (c.participant1Id === undefined ||
                  c.participant1Id === conversation.participant1Id) &&
                (c.participant2Id === undefined ||
                  c.participant2Id === conversation.participant2Id),
            );
            return Promise.resolve(match ? conversation : null);
          },
        ),
    };
    const messagesRepo: Record<string, jest.Mock> = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ...authInfra().imports,
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }]),
      ],
      controllers: [ConversationsController],
      providers: [
        ...authInfra().providers,
        ConversationsService,
        {
          provide: getRepositoryToken(Conversation),
          useValue: conversationsRepo,
        },
        { provide: getRepositoryToken(Message), useValue: messagesRepo },
      ],
    }).compile();

    app = await initApp(module);
    jwt = app.get(JwtService);
  });

  afterAll(() => app.close());

  describe('GET /v1/conversations/:id', () => {
    it('rejects an anonymous request with 401', () =>
      request(app.getHttpServer()).get('/v1/conversations/conv-1').expect(401));

    it('denies a non-participant', () =>
      request(app.getHttpServer())
        .get('/v1/conversations/conv-1')
        .set('Authorization', bearer(STRANGER_ID))
        .expect(404));

    it('allows a participant to read it', () =>
      request(app.getHttpServer())
        .get('/v1/conversations/conv-1')
        .set('Authorization', bearer(OWNER_ID))
        .expect(200)
        .expect((res) => {
          expect((res.body as { id: string }).id).toBe('conv-1');
        }));

    it('allows the other participant to read it too', () =>
      request(app.getHttpServer())
        .get('/v1/conversations/conv-1')
        .set('Authorization', bearer(OTHER_ID))
        .expect(200));
  });

  describe('GET /v1/conversations/:id/messages', () => {
    it('denies a non-participant', () =>
      request(app.getHttpServer())
        .get('/v1/conversations/conv-1/messages')
        .set('Authorization', bearer(STRANGER_ID))
        .expect(404));

    it('allows a participant', () =>
      request(app.getHttpServer())
        .get('/v1/conversations/conv-1/messages')
        .set('Authorization', bearer(OWNER_ID))
        .expect(200));
  });
});

// ── Games: join uses the JWT subject, not the body (#1416) ───────────────

describe('Games join identity (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let mockManager: Record<string, jest.Mock>;

  const bearer = (sub: string) => `Bearer ${jwt.sign({ sub })}`;

  const game: Partial<Game> = {
    id: 'game-1',
    status: GameStatus.PENDING,
    number_of_players: 4,
    players: [],
    game_settings: { starting_cash: 1500, randomize_turn_order: false },
  };

  beforeAll(async () => {
    mockManager = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: authInfra().imports,
      controllers: [GamesController],
      providers: [
        ...authInfra().providers,
        GamesService,
        { provide: getRepositoryToken(Game), useValue: {} },
        { provide: getRepositoryToken(Player), useValue: {} },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(
              (cb: (manager: typeof mockManager) => Promise<unknown>) =>
                cb(mockManager),
            ),
          },
        },
      ],
    }).compile();

    app = await initApp(module);
    jwt = app.get(JwtService);
  });

  afterAll(() => app.close());

  beforeEach(() => {
    mockManager.findOne.mockReset();
    mockManager.create.mockReset();
    mockManager.save.mockReset();
  });

  it('rejects an anonymous join with 401', () =>
    request(app.getHttpServer())
      .post('/v1/games/game-1/join')
      .send({})
      .expect(401));

  it('joins as the JWT subject, ignoring a spoofed body userId', async () => {
    mockManager.findOne.mockResolvedValueOnce(game).mockResolvedValueOnce(null);
    mockManager.create.mockImplementation(
      (_entity: unknown, data: Record<string, unknown>) => data,
    );
    mockManager.save.mockImplementation(
      (_entity: unknown, data: Record<string, unknown>) =>
        Promise.resolve({ id: 'player-1', ...data }),
    );

    const res = await request(app.getHttpServer())
      .post('/v1/games/game-1/join')
      .set('Authorization', bearer(OWNER_ID))
      .send({ userId: OTHER_ID }) // spoofed identity in the body
      .expect(201);

    const body = res.body as { user_id: string };
    expect(body.user_id).toBe(OWNER_ID);
    expect(body.user_id).not.toBe(OTHER_ID);
    expect(mockManager.findOne).toHaveBeenCalledWith(
      Player,
      expect.objectContaining({
        where: { game_id: 'game-1', user_id: OWNER_ID },
      }),
    );
  });
});

// ── Analytics: JWT + role RBAC, self-scoped for non-admins (#1417) ───────

describe('Analytics RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let mockSubscriptionsService: { getCompletedPayments: jest.Mock };

  const bearer = (sub: string) => `Bearer ${jwt.sign({ sub })}`;

  const payment = (creatorAddress: string) => ({
    id: 'pay-1',
    creatorAddress,
    fanAddress: 'GFAN',
    amount: '10.0000000',
    fee: '0.5000000',
    assetCode: 'XLM',
    txHash: 'tx',
    updatedAt: new Date(),
  });

  beforeAll(async () => {
    mockSubscriptionsService = { getCompletedPayments: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      imports: authInfra().imports,
      controllers: [AnalyticsController],
      providers: [
        ...authInfra().providers,
        AnalyticsService,
        { provide: SubscriptionsService, useValue: mockSubscriptionsService },
      ],
    }).compile();

    app = await initApp(module);
    jwt = app.get(JwtService);
  });

  afterAll(() => app.close());

  it('rejects an anonymous request with 401', () =>
    request(app.getHttpServer()).get('/v1/analytics/payments').expect(401));

  it('rejects a plain USER role with 403', async () => {
    const PLAIN_USER_ID = '55555555-5555-4555-8555-555555555555';
    USERS[PLAIN_USER_ID] = {
      id: PLAIN_USER_ID,
      email: 'user@myfans.test',
      role: UserRole.USER,
    };

    await request(app.getHttpServer())
      .get('/v1/analytics/payments')
      .set('Authorization', bearer(PLAIN_USER_ID))
      .expect(403);
  });

  it('auto-scopes a creator to their own payments even with no filter', async () => {
    mockSubscriptionsService.getCompletedPayments.mockReturnValue([
      payment(OWNER_ID),
      payment(OTHER_ID),
    ]);

    const res = await request(app.getHttpServer())
      .get('/v1/analytics/payments')
      .set('Authorization', bearer(OWNER_ID))
      .expect(200);

    const body = res.body as { data: { creator: string }[] };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].creator).toBe(OWNER_ID);
  });

  it('rejects a creator explicitly requesting another creator with 403', async () => {
    await request(app.getHttpServer())
      .get('/v1/analytics/payments')
      .query({ creator: OTHER_ID })
      .set('Authorization', bearer(OWNER_ID))
      .expect(403);
  });

  it('lets an admin see cross-creator aggregates', async () => {
    mockSubscriptionsService.getCompletedPayments.mockReturnValue([
      payment(OWNER_ID),
      payment(OTHER_ID),
    ]);

    const res = await request(app.getHttpServer())
      .get('/v1/analytics/payments')
      .set('Authorization', bearer(ADMIN_ID))
      .expect(200);

    expect((res.body as { data: unknown[] }).data).toHaveLength(2);
  });
});
