import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationRetryStoreService } from './notification-retry-store.service';
import { NotificationRetryJobEntity } from './entities/notification-retry-job.entity';

const mockRepo = () => ({
  create: jest.fn((data: Partial<NotificationRetryJobEntity>) => data),
  save: jest.fn(async (entity: unknown) => entity),
  find: jest.fn(),
});

describe('NotificationRetryStoreService', () => {
  let service: NotificationRetryStoreService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationRetryStoreService,
        { provide: getRepositoryToken(NotificationRetryJobEntity), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(NotificationRetryStoreService);
    repo = module.get(getRepositoryToken(NotificationRetryJobEntity));
  });

  it('upserts a job record as an entity row', async () => {
    await service.upsert({
      dedupeKey: 'k1',
      payload: {
        dedupeKey: 'k1',
        event: 'renewed',
        recipientUserId: 'user-1',
        creatorUserId: 'creator-1',
        subscriptionId: 'sub-1',
        planId: 1,
      },
      attempts: 1,
      status: 'pending',
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ dedupe_key: 'k1', attempts: 1, status: 'pending' }),
    );
  });

  it('lists all jobs mapped back to the RetryJobRecord shape', async () => {
    repo.find.mockResolvedValue([
      {
        dedupe_key: 'k1',
        payload: { dedupeKey: 'k1' },
        attempts: 2,
        status: 'failed',
        last_error: 'boom',
      },
    ]);

    const result = await service.listAll();

    expect(result).toEqual([
      {
        dedupeKey: 'k1',
        payload: { dedupeKey: 'k1' },
        attempts: 2,
        status: 'failed',
        lastError: 'boom',
      },
    ]);
  });

  it('lists only pending jobs', async () => {
    repo.find.mockResolvedValue([]);
    await service.listPending();
    expect(repo.find).toHaveBeenCalledWith({ where: { status: 'pending' } });
  });
});
