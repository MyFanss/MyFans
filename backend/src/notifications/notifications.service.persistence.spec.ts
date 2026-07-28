import { NotificationsService } from './notifications.service';
import { NotificationType } from './entities/notification.entity';

const mockNotificationsRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((dto: any) => dto),
  save: jest.fn(async (n: any) => n),
  update: jest.fn(),
  remove: jest.fn(),
  count: jest.fn(),
});

const mockRetryStore = () => ({
  upsert: jest.fn().mockResolvedValue(undefined),
  listAll: jest.fn().mockResolvedValue([]),
  listPending: jest.fn().mockResolvedValue([]),
});

const mockDigestStore = () => ({
  get: jest.fn(),
  set: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  listAll: jest.fn().mockResolvedValue([]),
});

const mockEmailOutbox = () => ({
  enqueue: jest.fn().mockResolvedValue(undefined),
  processPending: jest.fn().mockResolvedValue(undefined),
  listAll: jest.fn().mockResolvedValue([]),
});

const mockUsersService = () => ({
  getNotificationPreferences: jest.fn(),
});

describe('NotificationsService — durable persistence', () => {
  let repo: ReturnType<typeof mockNotificationsRepo>;
  let retryStore: ReturnType<typeof mockRetryStore>;
  let digestStore: ReturnType<typeof mockDigestStore>;
  let emailOutbox: ReturnType<typeof mockEmailOutbox>;
  let usersService: ReturnType<typeof mockUsersService>;
  let service: NotificationsService;

  beforeEach(() => {
    repo = mockNotificationsRepo();
    retryStore = mockRetryStore();
    digestStore = mockDigestStore();
    emailOutbox = mockEmailOutbox();
    usersService = mockUsersService();

    service = new NotificationsService(
      repo as any,
      5 * 60 * 1000,
      retryStore as any,
      digestStore as any,
      emailOutbox as any,
      usersService as any,
    );
  });

  describe('hydrateFromStores / onModuleInit', () => {
    it('reloads pending retry jobs and open digest windows from the durable stores', async () => {
      retryStore.listAll.mockResolvedValue([
        {
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
        },
      ]);
      digestStore.listAll.mockResolvedValue([
        {
          key: 'user-1:subscription_renewed:creator-1',
          notificationId: 'notif-1',
          eventTimes: ['2026-01-01T00:00:00.000Z'],
          windowExpiresAt: Date.now() + 60_000,
        },
      ]);

      await service.onModuleInit();

      expect(service.getRetryQueueSnapshot()).toEqual([
        expect.objectContaining({ dedupeKey: 'k1', status: 'pending' }),
      ]);

      // A subsequent fold should find the rehydrated window and update in-place.
      repo.findOne.mockResolvedValue({
        id: 'notif-1',
        digest_count: 1,
        digest_event_times: ['2026-01-01T00:00:00.000Z'],
      });

      const folded = await service.foldIntoDigest(
        'user-1',
        NotificationType.SUBSCRIPTION_RENEWED,
        'creator-1',
        '2026-01-02T00:00:00.000Z',
      );

      expect(folded).not.toBeNull();
      expect(folded!.digest_count).toBe(2);
    });
  });

  describe('retry queue persistence', () => {
    it('mirrors the pending job to the retry store on enqueue', async () => {
      repo.findOne.mockResolvedValue(null);
      usersService.getNotificationPreferences.mockResolvedValue({
        email_subscription_renewal: true,
      });

      await service.enqueueSubscriptionLifecycleNotification({
        dedupeKey: 'k2',
        event: 'renewed',
        recipientUserId: 'user-1',
        creatorUserId: 'creator-1',
        subscriptionId: 'sub-1',
        planId: 1,
      });

      expect(retryStore.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ dedupeKey: 'k2', status: 'pending' }),
      );
      expect(retryStore.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ dedupeKey: 'k2', status: 'completed' }),
      );
    });
  });

  describe('digest window persistence', () => {
    it('persists a newly opened digest window', () => {
      service.openDigestWindow(
        'user-1',
        NotificationType.SUBSCRIPTION_RENEWED,
        'creator-1',
        'notif-1',
        '2026-01-01T00:00:00.000Z',
      );

      expect(digestStore.set).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'user-1:subscription_renewed:creator-1',
          notificationId: 'notif-1',
        }),
      );
    });

    it('persists the updated window when a fold succeeds', async () => {
      service.openDigestWindow(
        'user-1',
        NotificationType.SUBSCRIPTION_RENEWED,
        'creator-1',
        'notif-1',
        '2026-01-01T00:00:00.000Z',
      );
      repo.findOne.mockResolvedValue({ id: 'notif-1', digest_count: 1, digest_event_times: [] });

      await service.foldIntoDigest(
        'user-1',
        NotificationType.SUBSCRIPTION_RENEWED,
        'creator-1',
        '2026-01-02T00:00:00.000Z',
      );

      expect(digestStore.set).toHaveBeenCalledWith(
        expect.objectContaining({ eventTimes: expect.arrayContaining(['2026-01-02T00:00:00.000Z']) }),
      );
    });

    it('deletes the window when its notification has vanished', async () => {
      service.openDigestWindow(
        'user-1',
        NotificationType.SUBSCRIPTION_RENEWED,
        'creator-1',
        'ghost',
        '2026-01-01T00:00:00.000Z',
      );
      repo.findOne.mockResolvedValue(null);

      await service.foldIntoDigest(
        'user-1',
        NotificationType.SUBSCRIPTION_RENEWED,
        'creator-1',
        '2026-01-02T00:00:00.000Z',
      );

      expect(digestStore.delete).toHaveBeenCalledWith('user-1:subscription_renewed:creator-1');
    });
  });

  describe('durable email outbox', () => {
    it('enqueues a durable outbox entry alongside the in-memory sentEmails log', async () => {
      repo.findOne.mockResolvedValue(null);
      usersService.getNotificationPreferences.mockResolvedValue({
        email_subscription_renewal: true,
      });

      await service.enqueueSubscriptionLifecycleNotification({
        dedupeKey: 'k3',
        event: 'renewed',
        recipientUserId: 'user-1',
        creatorUserId: 'creator-1',
        subscriptionId: 'sub-1',
        planId: 1,
      });

      expect(emailOutbox.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ dedupeKey: 'k3', toUserId: 'user-1' }),
      );
      expect(service.getSentEmails()).toHaveLength(1);
    });
  });

  describe('preferences', () => {
    it('skips the email entirely when the recipient has disabled subscription-renewal emails', async () => {
      repo.findOne.mockResolvedValue(null);
      usersService.getNotificationPreferences.mockResolvedValue({
        email_subscription_renewal: false,
      });

      await service.enqueueSubscriptionLifecycleNotification({
        dedupeKey: 'k4',
        event: 'renewed',
        recipientUserId: 'user-1',
        creatorUserId: 'creator-1',
        subscriptionId: 'sub-1',
        planId: 1,
      });

      expect(emailOutbox.enqueue).not.toHaveBeenCalled();
      expect(service.getSentEmails()).toHaveLength(0);
    });

    it('fails open (still sends) if the preference lookup throws', async () => {
      repo.findOne.mockResolvedValue(null);
      usersService.getNotificationPreferences.mockRejectedValue(new Error('db down'));

      await service.enqueueSubscriptionLifecycleNotification({
        dedupeKey: 'k5',
        event: 'renewed',
        recipientUserId: 'user-1',
        creatorUserId: 'creator-1',
        subscriptionId: 'sub-1',
        planId: 1,
      });

      expect(service.getSentEmails()).toHaveLength(1);
    });
  });
});
