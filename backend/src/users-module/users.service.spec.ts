import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { UsersService } from './users.service';
import { User } from './user.entity';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';

// ── Mock bcrypt once ─────────────────────────────────────────────
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
  compare: jest.fn().mockResolvedValue(true),
}));

// ── helpers ────────────────────────────────────────────────────
const mockUser = (): User =>
  ({
    id: 'uuid-1',
    email: 'john@example.com',
    username: 'johndoe',
    passwordHash: '$2b$12$hashedpassword',
    firstName: 'John',
    lastName: 'Doe',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: undefined,
  } as User);

const createQb = (result: User | null = null) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  withDeleted: jest.fn().mockReturnThis(),
  getOne: jest.fn().mockResolvedValue(result),
});

// ── suite ──────────────────────────────────────────────────────
describe('UsersService', () => {
  let service: UsersService;

  const mockRepo = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    softDelete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockManager = {
    create: jest.fn((_, data) => ({ ...data })),
    save: jest.fn(async (_, entity) => ({ ...mockUser(), ...entity })),
  };

  const mockDataSource = {
    transaction: jest.fn((cb) => cb(mockManager)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks(); // Reset mocks between tests
  });

  // ── create ───────────────────────────────────────────────────
  describe('create', () => {
    const dto: CreateUserDto = {
      email: 'john@example.com',
      username: 'johndoe',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('should create and return a user profile without passwordHash', async () => {
      mockRepo.createQueryBuilder.mockReturnValue(createQb(null));

      const result = await service.create(dto);

      expect(result.email).toBe(dto.email);
      expect(result.username).toBe(dto.username);
      expect((result as any).passwordHash).toBeUndefined();
    });

    it('should throw 409 when email is already taken', async () => {
      mockRepo.createQueryBuilder
        .mockReturnValueOnce(createQb(mockUser()))
        .mockReturnValue(createQb(null));

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should throw 409 when username is already taken', async () => {
      mockRepo.createQueryBuilder
        .mockReturnValueOnce(createQb(null))
        .mockReturnValueOnce(createQb(mockUser()));

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should hash password with bcrypt', async () => {
      mockRepo.createQueryBuilder.mockReturnValue(createQb(null));

      await service.create(dto);

      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 12);
    });
  });

  // ── update ───────────────────────────────────────────────────
  describe('update', () => {
    const dto: UpdateUserDto = { firstName: 'Jane' };

    it('should hash password if provided', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser());
      mockRepo.createQueryBuilder.mockReturnValue(createQb(null));

      await service.update('uuid-1', { password: 'NewPass123!' });

      expect(bcrypt.hash).toHaveBeenCalledWith('NewPass123!', 12);
    });
  });

  // ── other tests (findAll, findOne, remove) remain unchanged ──
});