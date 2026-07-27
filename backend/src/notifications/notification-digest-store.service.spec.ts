import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationDigestStoreService } from './notification-digest-store.service';
import { NotificationDigestWindowEntity } from './entities/notification-digest-window.entity';

const mockRepo = () => ({
  create: jest.fn((data: Partial<NotificationDigestWindowEntity>) => data),
  save: jest.fn(async (entity: unknown) => entity),
  findOne: jest.fn(),
  delete: jest.fn(),
  find: jest.fn(),
});

describe('NotificationDigestStoreService', () => {
  let service: NotificationDigestStoreService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationDigestStoreService,
        { provide: getRepositoryToken(NotificationDigestWindowEntity), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(NotificationDigestStoreService);
    repo = module.get(getRepositoryToken(NotificationDigestWindowEntity));
  });

  it('returns null when no window is open for the key', async () => {
    repo.findOne.mockResolvedValue(null);
    const result = await service.get('user-1:subscription_renewed:creator-1');
    expect(result).toBeNull();
  });

  it('returns the mapped record when a window exists, coercing bigint strings to numbers', async () => {
    repo.findOne.mockResolvedValue({
      digest_key: 'user-1:subscription_renewed:creator-1',
      notification_id: 'notif-1',
      event_times: ['2026-01-01T00:00:00.000Z'],
      window_expires_at: '1234567890123',
    });

    const result = await service.get('user-1:subscription_renewed:creator-1');

    expect(result).toEqual({
      key: 'user-1:subscription_renewed:creator-1',
      notificationId: 'notif-1',
      eventTimes: ['2026-01-01T00:00:00.000Z'],
      windowExpiresAt: 1234567890123,
    });
  });

  it('persists a new window via set', async () => {
    await service.set({
      key: 'k',
      notificationId: 'notif-1',
      eventTimes: ['t1'],
      windowExpiresAt: 999,
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ digest_key: 'k', notification_id: 'notif-1' }),
    );
  });

  it('deletes a window by key', async () => {
    await service.delete('k');
    expect(repo.delete).toHaveBeenCalledWith({ digest_key: 'k' });
  });
});
