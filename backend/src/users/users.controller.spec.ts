import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtService } from '@nestjs/jwt';
import { UserProfileDto } from './dto/user-profile.dto';

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-1',
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
      ],
    }).compile();

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
      const req = { user: { id: 'user-1' } };

      const result = await controller.getMe(req);

      expect(service.findOne).toHaveBeenCalledWith('user-1');
      expect(result).toBeInstanceOf(UserProfileDto);
      expect(result.id).toBe('user-1');
      expect(result.username).toBe('testuser');
    });

    it('throws when service.findOne rejects', async () => {
      service.findOne.mockRejectedValue(new Error('User not found'));
      const req = { user: { id: 'missing-user' } };

      await expect(controller.getMe(req)).rejects.toThrow('User not found');
    });
  });

  describe('updateMe', () => {
    it('calls service.update with the temp user id and dto', async () => {
      const updated = makeUser({ display_name: 'New Name' });
      service.update.mockResolvedValue(updated as any);
      const dto = { display_name: 'New Name' };

      const result = await controller.updateMe(dto as any);

      expect(service.update).toHaveBeenCalledWith('temp-user-id', dto);
      expect(result).toBeInstanceOf(UserProfileDto);
      expect(result.display_name).toBe('New Name');
    });

    it('propagates service errors', async () => {
      service.update.mockRejectedValue(new Error('DB error'));

      await expect(controller.updateMe({} as any)).rejects.toThrow('DB error');
    });
  });

  describe('updateOnboarding', () => {
    it('calls service.updateOnboarding with req.user.id and dto fields', async () => {
      const dto = {
        currentStep: 'profile',
        completedSteps: ['account-type'],
        skippedSteps: [] as string[],
        intent: 'creator',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      const updated = makeUser({
        onboarding_state: {
          currentStep: dto.currentStep,
          completedSteps: dto.completedSteps,
          skippedSteps: dto.skippedSteps,
          intent: dto.intent,
          updatedAt: dto.updatedAt,
        },
      });
      service.updateOnboarding.mockResolvedValue(updated as any);
      const req = { user: { id: 'user-1' } };

      const result = await controller.updateOnboarding(req as any, dto as any);

      expect(service.updateOnboarding).toHaveBeenCalledWith('user-1', {
        currentStep: 'profile',
        completedSteps: ['account-type'],
        skippedSteps: [],
        intent: 'creator',
        updatedAt: dto.updatedAt,
      });
      expect(result).toHaveProperty('onboarding_state');
    });

    it('defaults intent to null when omitted', async () => {
      const dto = {
        currentStep: 'profile',
        completedSteps: [],
        skippedSteps: [],
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      service.updateOnboarding.mockResolvedValue(makeUser() as any);
      const req = { user: { id: 'user-1' } };

      await controller.updateOnboarding(req as any, dto as any);

      expect(service.updateOnboarding).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ intent: null }),
      );
    });

    it('propagates service errors', async () => {
      service.updateOnboarding.mockRejectedValue(new Error('Not found'));
      const req = { user: { id: 'user-1' } };

      await expect(
        controller.updateOnboarding(req as any, {} as any),
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
      service.updateNotificationPreferences.mockResolvedValue(serviceResult as any);
      const req = { user: { id: 'user-1' } };

      const result = await controller.updateNotifications(req as any, dto as any);

      expect(service.updateNotificationPreferences).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(serviceResult);
    });

    it('propagates service errors', async () => {
      service.updateNotificationPreferences.mockRejectedValue(new Error('DB error'));
      const req = { user: { id: 'user-1' } };

      await expect(
        controller.updateNotifications(req as any, {} as any),
      ).rejects.toThrow('DB error');
    });
  });

  describe('removeMe', () => {
    it('calls service.remove when password is valid', async () => {
      service.validatePassword.mockResolvedValue(true);
      service.remove.mockResolvedValue(undefined);
      const req = { user: { id: 'user-1' } };

      await controller.removeMe(req as any, { password: 'correct' });

      expect(service.validatePassword).toHaveBeenCalledWith('user-1', 'correct');
      expect(service.remove).toHaveBeenCalledWith('user-1');
    });

    it('throws UnauthorizedException when password is invalid', async () => {
      service.validatePassword.mockResolvedValue(false);
      const req = { user: { id: 'user-1' } };

      await expect(
        controller.removeMe(req as any, { password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(service.remove).not.toHaveBeenCalled();
    });

    it('does not call remove when validatePassword rejects', async () => {
      service.validatePassword.mockRejectedValue(new Error('DB error'));
      const req = { user: { id: 'user-1' } };

      await expect(
        controller.removeMe(req as any, { password: 'any' }),
      ).rejects.toThrow('DB error');
      expect(service.remove).not.toHaveBeenCalled();
    });
  });
});
