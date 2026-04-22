import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Notification, NotificationType } from './entities/notification.entity';

const mockNotification = (): Notification => ({
  id: 'notif-1',
  user_id: 'user-1',
  user: null as any,
  type: NotificationType.NEW_SUBSCRIBER,
  title: 'New subscriber',
  body: '@fan subscribed to your plan',
  is_read: false,
  metadata: null,
  created_at: new Date(),
});

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  count: jest.fn(),
});

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(NotificationsService);
    repo = module.get(getRepositoryToken(Notification));
  });

  describe('findAllForUser', () => {
    it('returns all notifications for a user', async () => {
      const notif = mockNotification();
      repo.find.mockResolvedValue([notif]);
      const result = await service.findAllForUser('user-1');
      expect(result).toEqual([notif]);
      expect(repo.find).toHaveBeenCalledWith({
        where: { user_id: 'user-1' },
        order: { created_at: 'DESC' },
      });
    });

    it('filters unread when unreadOnly=true', async () => {
      repo.find.mockResolvedValue([]);
      await service.findAllForUser('user-1', true);
      expect(repo.find).toHaveBeenCalledWith({
        where: { user_id: 'user-1', is_read: false },
        order: { created_at: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('returns a notification', async () => {
      const notif = mockNotification();
      repo.findOne.mockResolvedValue(notif);
      const result = await service.findOne('notif-1', 'user-1');
      expect(result).toEqual(notif);
    });

    it('throws NotFoundException when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad-id', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markRead', () => {
    it('marks a notification as read', async () => {
      const notif = mockNotification();
      repo.findOne.mockResolvedValue(notif);
      repo.save.mockResolvedValue({ ...notif, is_read: true });
      const result = await service.markRead('notif-1', 'user-1', { is_read: true });
      expect(result.is_read).toBe(true);
    });
  });

  describe('markAllRead', () => {
    it('marks all notifications as read', async () => {
      repo.update.mockResolvedValue({ affected: 3 });
      const result = await service.markAllRead('user-1');
      expect(result).toEqual({ updated: 3 });
    });
  });

  describe('getUnreadCount', () => {
    it('returns unread count', async () => {
      repo.count.mockResolvedValue(5);
      const result = await service.getUnreadCount('user-1');
      expect(result).toEqual({ count: 5 });
    });
  });

  describe('remove', () => {
    it('removes a notification', async () => {
      const notif = mockNotification();
      repo.findOne.mockResolvedValue(notif);
      repo.remove.mockResolvedValue(undefined);
      await expect(service.remove('notif-1', 'user-1')).resolves.toBeUndefined();
    });
  });

  describe('subscription lifecycle queue', () => {
    it('builds renew templates for in-app and email delivery', () => {
      const template = service.buildSubscriptionLifecycleTemplate({
        dedupeKey: 'renew:1',
        event: 'renewed',
        recipientUserId: 'user-1',
        creatorUserId: 'creator-1',
        creatorDisplayName: 'Creator One',
        subscriptionId: 'sub-1',
        planId: 1,
      });

      expect(template.inApp.title).toBe('Subscription renewed');
      expect(template.inApp.body).toContain('Creator One');
      expect(template.email.subject).toContain('renewed');
    });

    it('deduplicates repeated lifecycle notifications', async () => {
      const notif = {
        ...mockNotification(),
        type: NotificationType.SUBSCRIPTION_RENEWED,
        title: 'Subscription renewed',
      };
      repo.create.mockReturnValue(notif);
      repo.save.mockResolvedValue(notif);

      const payload = {
        dedupeKey: 'subscription.renewed:sub-1:123',
        event: 'renewed' as const,
        recipientUserId: 'user-1',
        creatorUserId: 'creator-1',
        subscriptionId: 'sub-1',
        planId: 1,
      };

      const first = await service.enqueueSubscriptionLifecycleNotification(payload);
      const second = await service.enqueueSubscriptionLifecycleNotification(payload);

      expect(first).toEqual(notif);
      expect(second).toEqual(notif);
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('retries pending jobs without creating duplicates', async () => {
      const notif = {
        ...mockNotification(),
        type: NotificationType.SUBSCRIPTION_CANCELLED,
        title: 'Subscription cancelled',
      };
      repo.create.mockReturnValue(notif);
      repo.save
        .mockRejectedValueOnce(new Error('db unavailable'))
        .mockResolvedValueOnce(notif);

      await service.enqueueSubscriptionLifecycleNotification({
        dedupeKey: 'subscription.cancelled:sub-1:456',
        event: 'cancelled',
        recipientUserId: 'user-1',
        creatorUserId: 'creator-1',
        subscriptionId: 'sub-1',
        planId: 1,
      });

      expect(service.getRetryQueueSnapshot()[0]?.status).toBe('pending');

      await service.processRetryQueue();

      expect(repo.save).toHaveBeenCalledTimes(2);
      expect(service.getRetryQueueSnapshot()[0]?.status).toBe('completed');
      expect(service.getSentEmails()).toHaveLength(1);
    });
  });
});
