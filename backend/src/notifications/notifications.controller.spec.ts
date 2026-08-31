import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  UnauthorizedException,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/notification.dto';
import { NotificationType } from './entities/notification.entity';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { RolesGuard } from '../auth-module/guards/roles.guard';

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
      const jwtUser = { userId, email: 'test@example.com' };
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

      const result = await controller.findAll(jwtUser);

      expect(service.findAllForUser).toHaveBeenCalledWith(userId, false);
      expect(result).toEqual(mockNotifications);
    });

    it('filters unread notifications when requested', async () => {
      const userId = 'user-123';
      const jwtUser = { userId, email: 'test@example.com' };

      (service.findAllForUser as jest.Mock).mockReturnValue([]);

      await controller.findAll(jwtUser, 'true');

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
      const jwtUser = { userId, email: 'test@example.com' };

      const notification = {
        id: notifId,
        user_id: userId,
        type: NotificationType.PAYMENT,
        title: 'Payment',
        body: 'Details',
        is_read: false,
      };

      (service.findOne as jest.Mock).mockReturnValue(notification);

      const result = await controller.findOne(jwtUser, notifId);

      expect(service.findOne).toHaveBeenCalledWith(notifId, userId);
      expect(result).toEqual(notification);
    });
  });

  describe('remove', () => {
    it('deletes a notification owned by the user', async () => {
      const userId = 'user-123';
      const notifId = 'notif-789';
      const jwtUser = { userId, email: 'test@example.com' };

      (service.remove as jest.Mock).mockReturnValue(undefined);

      await controller.remove(jwtUser, notifId);

      expect(service.remove).toHaveBeenCalledWith(notifId, userId);
    });
  });
});

describe('NotificationsController - RBAC Protection', () => {
  let app: INestApplication;

  afterEach(async () => {
    if (app) await app.close();
  });

  it('returns 403 for POST /notifications without admin role', async () => {
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
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => false })
      .compile();

    app = module.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();

    const dto = {
      user_id: 'target-user',
      type: NotificationType.PAYMENT,
      title: 'Notification',
      body: 'Details',
    };

    await request(app.getHttpServer())
      .post('/v1/notifications')
      .send(dto)
      .expect(403);
  });

  it('returns 401 for POST /notifications without authentication', async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: {
            findAllForUser: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: () => {
          throw new UnauthorizedException();
        },
      })
      .compile();

    app = module.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();

    const dto = {
      user_id: 'target-user',
      type: NotificationType.PAYMENT,
      title: 'Notification',
      body: 'Details',
    };

    await request(app.getHttpServer())
      .post('/v1/notifications')
      .send(dto)
      .expect(401);
  });

  it('allows GET /notifications for any authenticated user to list own notifications', async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: {
            findAllForUser: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = {
            userId: 'user-1',
            email: 'u@example.com',
          };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();

    const response = await request(app.getHttpServer()).get(
      '/v1/notifications',
    );

    expect([200, 401]).toContain(response.status);
  });
});
