import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;

  const mockUsersService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('returns the user when found', async () => {
      const user = { id: 'u1', email: 'a@b.com', role: 'USER' };
      mockUsersService.findOne.mockResolvedValue(user);

      const result = await service.validateUser('u1');

      expect(result).toEqual(user);
      expect(mockUsersService.findOne).toHaveBeenCalledWith('u1');
    });

    it('returns null when user is not found', async () => {
      mockUsersService.findOne.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      const result = await service.validateUser('missing');

      expect(result).toBeNull();
    });

    it('re-throws non-NotFoundException errors', async () => {
      mockUsersService.findOne.mockRejectedValue(new Error('DB down'));

      await expect(service.validateUser('u1')).rejects.toThrow('DB down');
    });
  });

  describe('findById', () => {
    it('returns the user by id', async () => {
      const user = { id: 'u2', email: 'b@c.com', role: 'CREATOR' };
      mockUsersService.findOne.mockResolvedValue(user);

      const result = await service.findById('u2');

      expect(result).toEqual(user);
      expect(mockUsersService.findOne).toHaveBeenCalledWith('u2');
    });

    it('propagates NotFoundException from UsersService', async () => {
      mockUsersService.findOne.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(service.findById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('register', () => {
    it('throws Method not implemented', () => {
      expect(() =>
        service.register({
          email: 'new@user.com',
          password: 'securePass1',
          firstName: 'Test',
          lastName: 'User',
        }),
      ).toThrow('Method not implemented.');
    });
  });
});
