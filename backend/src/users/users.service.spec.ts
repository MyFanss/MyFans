import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

const mockBcryptCompare = jest.fn();
jest.mock('bcrypt', () => ({
  ...jest.requireActual('bcrypt'),
  compare: (...args: unknown[]) => mockBcryptCompare(...args),
}));

describe('UsersService', () => {
  let service: UsersService;
  let repository: any;

  const mockUser = {
    id: 'user-id',
    email: 'test@example.com',
    password_hash: 'hashed_password',
  };

  const mockRepository = {
    findOne: jest.fn(),
    softDelete: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validatePassword', () => {
    it('should return true for valid password', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      mockBcryptCompare.mockResolvedValue(true);

      const result = await service.validatePassword('user-id', 'correct_password');
      expect(result).toBe(true);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        select: ['id', 'password_hash'],
      });
    });

    it('should return false for invalid password', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      mockBcryptCompare.mockResolvedValue(false);

      const result = await service.validatePassword('user-id', 'wrong_password');
      expect(result).toBe(false);
    });

    it('should return false if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.validatePassword('user-id', 'any_password');
      expect(result).toBe(false);
    });
  });

  describe('remove', () => {
    it('should soft delete user', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      repository.softDelete.mockResolvedValue({ affected: 1 });

      await service.remove('user-id');
      expect(repository.softDelete).toHaveBeenCalledWith('user-id');
    });

    it('should throw NotFoundException if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.remove('user-id')).rejects.toThrow(NotFoundException);
    });
  });
});
