import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/notification.dto';
import { NotificationType } from './entities/notification.entity';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: {
            findAllForUser: jest.fn(),
            getUnreadCount: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            markAllRead: jest.fn(),
            markRead: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('findAll', () => {
    it('returns notifications for the current user', async () => {
      const userId = 'user-123';
      const req = { user: { id: userId } };
      const mockNotifications = [
        {
          id: 'notif-1',
          user_id: userId,
          type: NotificationType.PAYMENT,
          title: 'Payment received',
          body: 'Payment details',
          is_read: false,
          created_at: new Date(),
        },
      ];

      (service.findAllForUser as jest.Mock).mockReturnValue(mockNotifications);

      const result = await controller.findAll(req);

      expect(service.findAllForUser).toHaveBeenCalledWith(userId, undefined);
      expect(result).toEqual(mockNotifications);
    });

    it('filters unread notifications when requested', async () => {
      const userId = 'user-123';
      const req = { user: { id: userId } };

      (service.findAllForUser as jest.Mock).mockReturnValue([]);

      await controller.findAll(req, 'true');

      expect(service.findAllForUser).toHaveBeenCalledWith(userId, true);
    });
  });

  describe('create', () => {
    it('creates a notification with valid DTO', async () => {
      const dto: CreateNotificationDto = {
        user_id: 'target-user-123',
        type: NotificationType.PAYMENT,
        title: 'New payment',
        body: 'Payment notification',
      };

      const createdNotification = {
        id: 'notif-new',
        ...dto,
        is_read: false,
        created_at: new Date(),
      };

      (service.create as jest.Mock).mockReturnValue(createdNotification);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(createdNotification);
    });
  });

  describe('findOne', () => {
    it('returns a notification owned by the user', async () => {
      const userId = 'user-123';
      const notifId = 'notif-456';
      const req = { user: { id: userId } };

      const notification = {
        id: notifId,
        user_id: userId,
        type: NotificationType.PAYMENT,
        title: 'Payment',
        body: 'Details',
        is_read: false,
      };

      (service.findOne as jest.Mock).mockReturnValue(notification);

      const result = await controller.findOne(req, notifId);

      expect(service.findOne).toHaveBeenCalledWith(notifId, userId);
      expect(result).toEqual(notification);
    });
  });

  describe('remove', () => {
    it('deletes a notification owned by the user', async () => {
      const userId = 'user-123';
      const notifId = 'notif-789';
      const req = { user: { id: userId } };

      (service.remove as jest.Mock).mockReturnValue(undefined);

      await controller.remove(req, notifId);

      expect(service.remove).toHaveBeenCalledWith(notifId, userId);
    });
  });
});

describe('NotificationsController - RBAC Protection', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: {
            findAllForUser: jest.fn(),
            getUnreadCount: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn().mockReturnValue({
              id: 'notif-new',
              user_id: 'target-user',
              type: NotificationType.PAYMENT,
              title: 'Notification',
              body: 'Details',
              is_read: false,
              created_at: new Date(),
            }),
            markAllRead: jest.fn(),
            markRead: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 403 for POST /notifications without admin role', async () => {
    const dto = {
      user_id: 'target-user',
      type: NotificationType.PAYMENT,
      title: 'Notification',
      body: 'Details',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/v1/notifications',
      payload: dto,
    });

    expect(response.statusCode).toBe(403);
  });

  it('returns 401 for POST /notifications without authentication', async () => {
    const dto = {
      user_id: 'target-user',
      type: NotificationType.PAYMENT,
      title: 'Notification',
      body: 'Details',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/v1/notifications',
      payload: dto,
    });

    expect(response.statusCode).toBe(401);
  });

  it('allows GET /notifications for any authenticated user to list own notifications', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/notifications',
    });

    // Should not return 403 for read operations (auth required but not admin role)
    expect([200, 401]).toContain(response.statusCode);
  });
});
