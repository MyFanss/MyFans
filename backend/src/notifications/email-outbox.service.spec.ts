import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmailOutboxService } from './email-outbox.service';
import {
  EmailOutboxEntry,
  EmailOutboxStatus,
} from './entities/email-outbox-entry.entity';
import { EMAIL_ADAPTER } from './adapters/email-adapter.interface';

const mockRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn(
    (data: Partial<EmailOutboxEntry>) => ({ ...data }) as EmailOutboxEntry,
  ),
  save: jest.fn(async (entity: EmailOutboxEntry) => entity),
  find: jest.fn(),
});

describe('EmailOutboxService', () => {
  let service: EmailOutboxService;
  let repo: ReturnType<typeof mockRepo>;
  let adapter: { send: jest.Mock };

  beforeEach(async () => {
    adapter = { send: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailOutboxService,
        { provide: getRepositoryToken(EmailOutboxEntry), useFactory: mockRepo },
        { provide: EMAIL_ADAPTER, useValue: adapter },
      ],
    }).compile();

    service = module.get(EmailOutboxService);
    repo = module.get(getRepositoryToken(EmailOutboxEntry));
  });

  afterEach(() => jest.clearAllMocks());

  describe('enqueue', () => {
    it('persists the entry before attempting delivery, then marks it sent', async () => {
      repo.findOne.mockResolvedValue(null);
      adapter.send.mockResolvedValue(undefined);

      const result = await service.enqueue({
        dedupeKey: 'k1',
        toUserId: 'user-1',
        subject: 'Hi',
        body: 'Body',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          dedupe_key: 'k1',
          status: EmailOutboxStatus.PENDING,
        }),
      );
      expect(adapter.send).toHaveBeenCalledWith({
        to: 'user-1',
        subject: 'Hi',
        body: 'Body',
      });
      expect(result.status).toBe(EmailOutboxStatus.SENT);
      expect(result.sent_at).toBeInstanceOf(Date);
      expect(repo.save).toHaveBeenCalled();
    });

    it('is idempotent on dedupe_key — returns the existing row without re-sending', async () => {
      const existing = {
        dedupe_key: 'k1',
        status: EmailOutboxStatus.SENT,
      } as EmailOutboxEntry;
      repo.findOne.mockResolvedValue(existing);

      const result = await service.enqueue({
        dedupeKey: 'k1',
        toUserId: 'user-1',
        subject: 'Hi',
        body: 'Body',
      });

      expect(result).toBe(existing);
      expect(adapter.send).not.toHaveBeenCalled();
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('records the error and keeps the row pending when delivery fails', async () => {
      repo.findOne.mockResolvedValue(null);
      adapter.send.mockRejectedValue(new Error('smtp down'));

      const result = await service.enqueue({
        dedupeKey: 'k2',
        toUserId: 'user-2',
        subject: 'Hi',
        body: 'Body',
      });

      expect(result.status).toBe(EmailOutboxStatus.PENDING);
      expect(result.attempts).toBe(1);
      expect(result.last_error).toBe('smtp down');
    });

    it('marks the row failed once max attempts are exhausted', async () => {
      repo.findOne.mockResolvedValue(null);
      adapter.send.mockRejectedValue(new Error('smtp down'));

      // Simulate a row that has already failed 4 times.
      repo.create.mockReturnValueOnce({
        dedupe_key: 'k3',
        to_user_id: 'user-3',
        subject: 'Hi',
        body: 'Body',
        status: EmailOutboxStatus.PENDING,
        attempts: 4,
        last_error: null,
        sent_at: null,
      } as EmailOutboxEntry);

      const result = await service.enqueue({
        dedupeKey: 'k3',
        toUserId: 'user-3',
        subject: 'Hi',
        body: 'Body',
      });

      expect(result.attempts).toBe(5);
      expect(result.status).toBe(EmailOutboxStatus.FAILED);
    });
  });

  describe('processPending', () => {
    it('re-attempts delivery for every pending row', async () => {
      const rows = [
        {
          dedupe_key: 'a',
          to_user_id: 'u1',
          subject: 's',
          body: 'b',
          attempts: 0,
          status: EmailOutboxStatus.PENDING,
        },
        {
          dedupe_key: 'b',
          to_user_id: 'u2',
          subject: 's',
          body: 'b',
          attempts: 0,
          status: EmailOutboxStatus.PENDING,
        },
      ] as EmailOutboxEntry[];
      repo.find.mockResolvedValue(rows);
      adapter.send.mockResolvedValue(undefined);

      await service.processPending();

      expect(adapter.send).toHaveBeenCalledTimes(2);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          dedupe_key: 'a',
          status: EmailOutboxStatus.SENT,
        }),
      );
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          dedupe_key: 'b',
          status: EmailOutboxStatus.SENT,
        }),
      );
    });
  });

  describe('listAll', () => {
    it('returns rows ordered by creation time', async () => {
      repo.find.mockResolvedValue([]);
      await service.listAll();
      expect(repo.find).toHaveBeenCalledWith({ order: { created_at: 'ASC' } });
    });
  });
});
