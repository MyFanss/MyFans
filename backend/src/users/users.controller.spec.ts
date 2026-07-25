import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UnauthorizedException } from '@nestjs/common';
import { JwtUserPayload } from '../auth-module/decorators/current-user.decorator';

describe('UsersController', () => {
    let controller: UsersController;
    let service: any;

    const mockUsersService = {
        findOne: jest.fn(),
        updateOnboarding: jest.fn(),
        validatePassword: jest.fn(),
        remove: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [UsersController],
            providers: [
                {
                    provide: UsersService,
                    useValue: mockUsersService,
                },
            ],
        }).compile();

        controller = module.get<UsersController>(UsersController);
        service = module.get<UsersService>(UsersService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('removeMe', () => {
        const user: JwtUserPayload = { userId: 'user-id', email: 'a@b.com' };

        it('should call service.remove if password is valid', async () => {
            const dto = { password: 'correct_password' };
            service.validatePassword.mockResolvedValue(true);
            service.remove.mockResolvedValue(undefined);

            await controller.removeMe(user, dto);

            expect(service.validatePassword).toHaveBeenCalledWith('user-id', 'correct_password');
            expect(service.remove).toHaveBeenCalledWith('user-id');
        });

        it('should throw UnauthorizedException if password is invalid', async () => {
            const dto = { password: 'wrong_password' };
            service.validatePassword.mockResolvedValue(false);

            await expect(controller.removeMe(user, dto)).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('updateOnboarding', () => {
        it('should call service.updateOnboarding with userId and dto', async () => {
            const user: JwtUserPayload = { userId: 'user-id', email: 'a@b.com' };
            const dto = {
                currentStep: 'profile',
                completedSteps: ['account-type'],
                skippedSteps: [],
                intent: 'creator',
                updatedAt: new Date().toISOString(),
            };
            mockUsersService.updateOnboarding.mockResolvedValue({
                id: 'user-id',
                username: 'u',
                display_name: 'd',
                avatar_url: null,
                is_creator: false,
                onboarding_state: {
                    currentStep: dto.currentStep,
                    completedSteps: dto.completedSteps,
                    skippedSteps: dto.skippedSteps,
                    intent: dto.intent,
                    updatedAt: dto.updatedAt,
                },
            });

            const result = await controller.updateOnboarding(user, dto as any);

            expect(mockUsersService.updateOnboarding).toHaveBeenCalledWith('user-id', {
                currentStep: 'profile',
                completedSteps: ['account-type'],
                skippedSteps: [],
                intent: 'creator',
                updatedAt: dto.updatedAt,
            });
            expect(result).toHaveProperty('onboarding_state');
        });
    });
});
