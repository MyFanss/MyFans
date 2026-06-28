import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    findById: jest.fn(),
    findAllUsers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProfile', () => {
    it('returns user profile for authenticated user', async () => {
      const user = { id: 'u1', email: 'a@b.com' };
      mockAuthService.findById.mockResolvedValue(user);

      const result = await controller.getProfile({ user: { userId: 'u1' } });

      expect(result).toEqual(user);
      expect(mockAuthService.findById).toHaveBeenCalledWith('u1');
    });
  });

  describe('getUsers', () => {
    it('returns paginated users', async () => {
      const response = new PaginatedResponseDto(
        [{ id: 'u1' }],
        20,
        null,
        false,
        1,
      );
      mockAuthService.findAllUsers.mockResolvedValue(response);

      const result = await controller.getUsers({ limit: 20, page: 1 });

      expect(result).toEqual(response);
      expect(mockAuthService.findAllUsers).toHaveBeenCalledWith({
        limit: 20,
        page: 1,
      });
    });
  });
});
