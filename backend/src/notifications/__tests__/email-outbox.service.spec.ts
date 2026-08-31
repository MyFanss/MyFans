import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmailOutboxService } from '../email-outbox.service';
import { EmailOutboxEntry, EmailOutboxStatus } from '../entities/email-outbox-entry.entity';
import { EMAIL_ADAPTER } from '../adapters/email-adapter.interface';
import { UsersService } from '../../users/users.service';

function makeRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((data: Partial<EmailOutboxEntry>) => ({ id: 'entry-1', ...data }) as any),
    save: jest.fn((entry: any) => Promise.resolve(entry)),
  };
}

function makeAdapter() {
  return { send: jest.fn().mockResolvedValue({ messageId: 'msg-abc' }) };
}

function makeUsersService() {
  return { findOne: jest.fn().mockResolvedValue({ id: 'user-1' }) };
}

describe('EmailOutboxService', () => {
  let service: EmailOutboxService;
  let repo: ReturnType<typeof makeRepo>;
  let adapter: ReturnType<typeof makeAdapter>;

  beforeEach(async () => {
    repo = makeRepo();
    adapter = makeAdapter();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailOutboxService,
        { provide: getRepositoryToken(EmailOutboxEntry), useValue: repo },
        { provide: EMAIL_ADAPTER, useValue: adapter },
        { provide: UsersService, useValue: makeUsersService() },
      ],
    }).compile();

    service = module.get(EmailOutboxService);
  });

  it('enqueue creates an entry with PENDING status', async () => {
    repo.findOne.mockResolvedValue(null);

    const result = await service.enqueue({
      dedupeKey: 'dk-1',
      toUserId: 'user-1',
      subject: 'Test',
      body: 'Hello',
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: EmailOutboxStatus.PENDING, attempts: 0 }),
    );
    expect(result).toBeDefined();
  });

  it('deliver sets SENT status and captures provider_message_id', async () => {
    repo.findOne.mockResolvedValue(null);

    await service.enqueue({
      dedupeKey: 'dk-2',
      toUserId: 'user-1',
      subject: 'Test',
      body: 'Hello',
    });

    // save is called twice: once for create, once after delivery
    const lastSaved = repo.save.mock.calls[repo.save.mock.calls.length - 1][0];
    expect(lastSaved.status).toBe(EmailOutboxStatus.SENT);
    expect(lastSaved.provider_message_id).toBe('msg-abc');
  });

  it('moves entry to DEAD_LETTER after max attempts', async () => {
    repo.findOne.mockResolvedValue(null);
    adapter.send.mockRejectedValue(new Error('SMTP timeout'));

    const entry = {
      id: 'entry-1',
      dedupe_key: 'dk-3',
      to_user_id: 'user-1',
      subject: 'Test',
      body: 'Hello',
      status: EmailOutboxStatus.PENDING,
      attempts: 4, // one more failure will hit max (5)
      last_error: null,
      sent_at: null,
      provider_message_id: null,
    };

    repo.create.mockReturnValue(entry as any);

    await service.enqueue({
      dedupeKey: 'dk-3',
      toUserId: 'user-1',
      subject: 'Test',
      body: 'Hello',
    });

    expect(entry.status).toBe(EmailOutboxStatus.DEAD_LETTER);
    expect(entry.attempts).toBe(5);
  });

  it('replay resets DEAD_LETTER entry to PENDING', async () => {
    const entry = {
      id: 'entry-1',
      status: EmailOutboxStatus.DEAD_LETTER,
      attempts: 5,
      last_error: 'SMTP timeout',
    };
    repo.findOne.mockResolvedValue(entry);

    const result = await service.replayById('entry-1');

    expect(result.status).toBe(EmailOutboxStatus.PENDING);
    expect(result.attempts).toBe(0);
    expect(result.last_error).toBeNull();
  });

  it('replay throws if entry not found', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.replayById('missing')).rejects.toThrow(NotFoundException);
  });
});
