import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';

describe('UsersController', () => {
    let controller: UsersController;
    let service: any;

    const mockUsersService = {
        findOne: jest.fn(),
        validatePassword: jest.fn(),
        remove: jest.fn(),
    };

    const mockJwtService = {
        verifyAsync: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [UsersController],
            providers: [
                {
                    provide: UsersService,
                    useValue: mockUsersService,
                },
                {
                    provide: JwtService,
                    useValue: mockJwtService,
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
        it('should call service.remove if password is valid', async () => {
            const req = { user: { id: 'user-id' } };
            const dto = { password: 'correct_password' };
            service.validatePassword.mockResolvedValue(true);
            service.remove.mockResolvedValue(undefined);

            await controller.removeMe(req, dto);

            expect(service.validatePassword).toHaveBeenCalledWith('user-id', 'correct_password');
            expect(service.remove).toHaveBeenCalledWith('user-id');
        });

        it('should throw UnauthorizedException if password is invalid', async () => {
            const req = { user: { id: 'user-id' } };
            const dto = { password: 'wrong_password' };
            service.validatePassword.mockResolvedValue(false);

            await expect(controller.removeMe(req, dto)).rejects.toThrow(UnauthorizedException);
        });
    });
});
