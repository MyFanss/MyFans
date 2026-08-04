import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtService } from '@nestjs/jwt';
import { UserProfileDto } from './dto/user-profile.dto';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'jwt-user-1',
  username: 'testuser',
  display_name: 'Test User',
  avatar_url: null,
  is_creator: false,
  onboarding_state: null,
  created_at: new Date('2024-01-01'),
  email_notifications: true,
  push_notifications: false,
  marketing_emails: false,
  ...overrides,
});

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<
    Pick<
      UsersService,
      | 'findOne'
      | 'update'
      | 'updateOnboarding'
      | 'updateNotificationPreferences'
      | 'validatePassword'
      | 'remove'
    >
  >;

  beforeEach(async () => {
    service = {
      findOne: jest.fn(),
      update: jest.fn(),
      updateOnboarding: jest.fn(),
      updateNotificationPreferences: jest.fn(),
      validatePassword: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: service },
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
        {
          provide: JwtAuthGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMe', () => {
    it('returns a UserProfileDto for the authenticated user', async () => {
      const user = makeUser();
      service.findOne.mockResolvedValue(user as any);
      const jwtUser = { userId: 'jwt-user-1', email: 'test@example.com' };

      const result = await controller.getMe(jwtUser);

      expect(service.findOne).toHaveBeenCalledWith('jwt-user-1');
      expect(result).toBeInstanceOf(UserProfileDto);
      expect(result.id).toBe('jwt-user-1');
      expect(result.username).toBe('testuser');
    });

    it('throws when service.findOne rejects', async () => {
      service.findOne.mockRejectedValue(new Error('User not found'));
      const jwtUser = { userId: 'missing-user', email: 'test@example.com' };

      await expect(controller.getMe(jwtUser)).rejects.toThrow('User not found');
    });
  });

  describe('updateMe', () => {
    it('calls service.update with the JWT user id and dto', async () => {
      const updated = makeUser({ display_name: 'New Name' });
      service.update.mockResolvedValue(updated as any);
      const dto = { display_name: 'New Name' };

      const result = await controller.updateMe(dto as any, {
        id: 'jwt-user-1',
      });

      expect(service.update).toHaveBeenCalledWith('jwt-user-1', dto);
      expect(result).toBeInstanceOf(UserProfileDto);
      expect(result.display_name).toBe('New Name');
    });

    it('propagates service errors', async () => {
      service.update.mockRejectedValue(new Error('DB error'));

      await expect(
        controller.updateMe({} as any, { id: 'jwt-user-1' }),
      ).rejects.toThrow('DB error');
    });
  });

  describe('updateOnboarding', () => {
    it('calls service.updateOnboarding with req.user.id and dto fields', async () => {
      const dto = {
        currentStep: 'profile',
        completedSteps: ['account-type'],
        skippedSteps: [],
        intent: 'creator',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      service.updateOnboarding.mockResolvedValue(makeUser() as any);
      const jwtUser = { userId: 'user-1', email: 'test@example.com' };

      await controller.updateOnboarding(jwtUser, dto as any);

      expect(service.updateOnboarding).toHaveBeenCalledWith('user-1', {
        currentStep: 'profile',
        completedSteps: ['account-type'],
        skippedSteps: [],
        intent: 'creator',
        updatedAt: dto.updatedAt,
      });
    });

    it('defaults intent to null when omitted', async () => {
      const dto = {
        currentStep: 'profile',
        completedSteps: [],
        skippedSteps: [],
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      service.updateOnboarding.mockResolvedValue(makeUser() as any);
      const jwtUser = { userId: 'user-1', email: 'test@example.com' };

      await controller.updateOnboarding(jwtUser, dto as any);

      expect(service.updateOnboarding).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ intent: null }),
      );
    });

    it('propagates service errors', async () => {
      service.updateOnboarding.mockRejectedValue(new Error('Not found'));
      const jwtUser = { userId: 'user-1', email: 'test@example.com' };

      await expect(
        controller.updateOnboarding(jwtUser, {} as any),
      ).rejects.toThrow('Not found');
    });
  });

  describe('updateNotifications', () => {
    it('delegates to service.updateNotificationPreferences and returns result', async () => {
      const dto = { email_notifications: true, push_notifications: false };
      const serviceResult = {
        message: 'Notification preferences updated successfully',
        preferences: { email_notifications: true, push_notifications: false },
      };
      service.updateNotificationPreferences.mockResolvedValue(
        serviceResult as any,
      );
      const jwtUser = { userId: 'user-1', email: 'test@example.com' };

      const result = await controller.updateNotifications(jwtUser, dto as any);

      expect(service.updateNotificationPreferences).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(serviceResult);
    });

    it('propagates service errors', async () => {
      service.updateNotificationPreferences.mockRejectedValue(
        new Error('DB error'),
      );
      const jwtUser = { userId: 'user-1', email: 'test@example.com' };

      await expect(
        controller.updateNotifications(jwtUser, {} as any),
      ).rejects.toThrow('DB error');
    });
  });

  describe('removeMe', () => {
    it('calls service.remove when password is valid', async () => {
      service.validatePassword.mockResolvedValue(true);
      service.remove.mockResolvedValue(undefined);
      const jwtUser = { userId: 'user-1', email: 'test@example.com' };

      await controller.removeMe(jwtUser, { password: 'correct' });

      expect(service.validatePassword).toHaveBeenCalledWith(
        'user-1',
        'correct',
      );
      expect(service.remove).toHaveBeenCalledWith('user-1');
    });

    it('throws UnauthorizedException when password is invalid', async () => {
      service.validatePassword.mockResolvedValue(false);
      const jwtUser = { userId: 'user-1', email: 'test@example.com' };

      await expect(
        controller.removeMe(jwtUser, { password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(service.remove).not.toHaveBeenCalled();
    });

    it('does not call remove when validatePassword rejects', async () => {
      service.validatePassword.mockRejectedValue(new Error('DB error'));
      const jwtUser = { userId: 'user-1', email: 'test@example.com' };

      await expect(
        controller.removeMe(jwtUser, { password: 'any' }),
      ).rejects.toThrow('DB error');
      expect(service.remove).not.toHaveBeenCalled();
    });
  });
});
