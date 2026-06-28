import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { ConversationsModule } from './conversations.module';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';

const CONV_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'temp-user-id';
const OTHER_USER_ID = 'aaaaaaaa-0000-0000-0000-000000000002';
const MSG_ID = 'bbbbbbbb-0000-0000-0000-000000000001';

const stubConversation: Conversation = {
  id: CONV_ID,
  participant1Id: USER_ID,
  participant2Id: OTHER_USER_ID,
  lastMessageId: null,
  createdAt: new Date('2024-06-01T00:00:00Z'),
  updatedAt: new Date('2024-06-01T00:00:00Z'),
};

const stubMessage: Message = {
  id: MSG_ID,
  conversationId: CONV_ID,
  senderId: USER_ID,
  content: 'Hello e2e!',
  isRead: false,
  createdAt: new Date('2024-06-01T00:00:00Z'),
};

function makeQb(results: any[]) {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(results),
  };
  return qb;
}

class MockConversationsRepository {
  create = jest.fn().mockReturnValue(stubConversation);
  save = jest.fn().mockResolvedValue(stubConversation);
  findOne = jest.fn().mockResolvedValue(stubConversation);
  update = jest.fn().mockResolvedValue({});
  remove = jest.fn().mockResolvedValue({});
  createQueryBuilder = jest.fn().mockReturnValue(makeQb([stubConversation]));
}

class MockMessagesRepository {
  create = jest.fn().mockReturnValue(stubMessage);
  save = jest.fn().mockResolvedValue(stubMessage);
  createQueryBuilder = jest.fn().mockReturnValue(makeQb([stubMessage]));
}

describe('Conversations – e2e', () => {
  let app: INestApplication;
  let conversationsRepo: MockConversationsRepository;
  let messagesRepo: MockMessagesRepository;

  beforeAll(async () => {
    conversationsRepo = new MockConversationsRepository();
    messagesRepo = new MockMessagesRepository();

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConversationsModule],
    })
      .overrideProvider(getRepositoryToken(Conversation))
      .useValue(conversationsRepo)
      .overrideProvider(getRepositoryToken(Message))
      .useValue(messagesRepo)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.enableVersioning();

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/conversations', () => {
    it('creates a conversation and returns 201 with ConversationDto', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/conversations')
        .send({ participant2Id: OTHER_USER_ID })
        .expect(201);

      expect(res.body).toMatchObject({
        id: CONV_ID,
        participant1Id: USER_ID,
        participant2Id: OTHER_USER_ID,
      });
    });

    it('returns 400 when participant2Id is missing', async () => {
      await request(app.getHttpServer())
        .post('/v1/conversations')
        .send({})
        .expect(400);
    });

    it('returns 400 when participant2Id is an empty string', async () => {
      await request(app.getHttpServer())
        .post('/v1/conversations')
        .send({ participant2Id: '' })
        .expect(400);
    });
  });

  describe('GET /v1/conversations', () => {
    it('returns 200 with paginated conversations', async () => {
      conversationsRepo.createQueryBuilder.mockReturnValue(makeQb([stubConversation]));

      const res = await request(app.getHttpServer())
        .get('/v1/conversations')
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('hasMore');
      expect(res.body).toHaveProperty('nextCursor');
    });

    it('accepts limit query param', async () => {
      conversationsRepo.createQueryBuilder.mockReturnValue(makeQb([]));

      const res = await request(app.getHttpServer())
        .get('/v1/conversations?limit=5')
        .expect(200);

      expect(res.body).toHaveProperty('limit', 5);
    });

    it('accepts cursor query param without error', async () => {
      conversationsRepo.createQueryBuilder.mockReturnValue(makeQb([]));

      await request(app.getHttpServer())
        .get('/v1/conversations?cursor=some-cursor')
        .expect(200);
    });
  });

  describe('GET /v1/conversations/:id', () => {
    it('returns 200 with the conversation', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/conversations/${CONV_ID}`)
        .expect(200);

      expect(res.body).toMatchObject({ id: CONV_ID });
    });

    it('returns 404 when conversation does not exist', async () => {
      conversationsRepo.findOne.mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .get('/v1/conversations/nonexistent-id')
        .expect(404);
    });
  });

  describe('GET /v1/conversations/:id/messages', () => {
    it('returns 200 with paginated messages', async () => {
      messagesRepo.createQueryBuilder.mockReturnValue(makeQb([stubMessage]));

      const res = await request(app.getHttpServer())
        .get(`/v1/conversations/${CONV_ID}/messages`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 404 when conversation does not exist', async () => {
      conversationsRepo.findOne.mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .get('/v1/conversations/nonexistent-id/messages')
        .expect(404);
    });
  });

  describe('POST /v1/conversations/:id/messages', () => {
    it('returns 201 with the sent MessageDto', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/conversations/${CONV_ID}/messages`)
        .send({ content: 'Hello e2e!' })
        .expect(201);

      expect(res.body).toMatchObject({
        conversationId: CONV_ID,
        senderId: USER_ID,
        content: 'Hello e2e!',
      });
    });

    it('returns 400 when content is missing', async () => {
      await request(app.getHttpServer())
        .post(`/v1/conversations/${CONV_ID}/messages`)
        .send({})
        .expect(400);
    });

    it('returns 400 when content is an empty string', async () => {
      await request(app.getHttpServer())
        .post(`/v1/conversations/${CONV_ID}/messages`)
        .send({ content: '' })
        .expect(400);
    });

    it('returns 404 when conversation does not exist', async () => {
      conversationsRepo.findOne.mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .post('/v1/conversations/nonexistent-id/messages')
        .send({ content: 'Hi' })
        .expect(404);
    });
  });

  describe('DELETE /v1/conversations/:id', () => {
    it('returns 200 when conversation is removed', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/conversations/${CONV_ID}`)
        .expect(200);
    });

    it('returns 404 when conversation does not exist', async () => {
      conversationsRepo.findOne.mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .delete('/v1/conversations/nonexistent-id')
        .expect(404);
    });
  });
});
