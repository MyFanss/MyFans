import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

// ── helpers ──────────────────────────────────────────────────────────────────

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

// ── suite ─────────────────────────────────────────────────────────────────────

describe('UsersService', () => {
  let service: UsersService;

  const mockRepo = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    softDelete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  // transaction manager stub that delegates save/create back to repo-like fns
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
    jest.clearAllMocks();
  });

  // ── create ──────────────────────────────────────────────────────────────────

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
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed' as never);

      const result = await service.create(dto);

      expect(result.email).toBe(dto.email);
      expect(result.username).toBe(dto.username);
      expect((result as any).passwordHash).toBeUndefined();
    });

    it('should throw 409 when email is already taken', async () => {
      // first createQueryBuilder call (email check) returns a user
      mockRepo.createQueryBuilder
        .mockReturnValueOnce(createQb(mockUser()))
        .mockReturnValue(createQb(null));

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should throw 409 when username is already taken', async () => {
      mockRepo.createQueryBuilder
        .mockReturnValueOnce(createQb(null))  // email ok
        .mockReturnValueOnce(createQb(mockUser())); // username taken

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should hash password with bcrypt', async () => {
      mockRepo.createQueryBuilder.mockReturnValue(createQb(null));
      const hashSpy = jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed' as never);

      await service.create(dto);

      expect(hashSpy).toHaveBeenCalledWith(dto.password, 12);
    });
  });

  // ── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const users = [mockUser(), mockUser()];
      mockRepo.findAndCount.mockResolvedValue([users, 2]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);
      expect((result.data[0] as any).passwordHash).toBeUndefined();
    });

    it('should calculate correct offset', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ page: 3, limit: 10 });

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  // ── findOne ─────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a user profile', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser());

      const result = await service.findOne('uuid-1');

      expect(result.id).toBe('uuid-1');
      expect((result as any).passwordHash).toBeUndefined();
    });

    it('should throw 404 when user does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    const dto: UpdateUserDto = { firstName: 'Jane' };

    it('should update and return user profile', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser());
      mockRepo.createQueryBuilder.mockReturnValue(createQb(null));

      const result = await service.update('uuid-1', dto);

      expect(result).toBeDefined();
      expect((result as any).passwordHash).toBeUndefined();
    });

    it('should hash password if provided', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser());
      mockRepo.createQueryBuilder.mockReturnValue(createQb(null));
      const hashSpy = jest.spyOn(bcrypt, 'hash').mockResolvedValue('newhashed' as never);

      await service.update('uuid-1', { password: 'NewPass123!' });

      expect(hashSpy).toHaveBeenCalledWith('NewPass123!', 12);
    });

    it('should throw 404 when user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.update('bad-id', dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw 409 on duplicate email during update', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser());
      // email uniqueness check finds another user
      mockRepo.createQueryBuilder.mockReturnValue(createQb(mockUser()));

      await expect(
        service.update('uuid-1', { email: 'taken@example.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should soft-delete a user', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser());
      mockRepo.softDelete.mockResolvedValue({ affected: 1 });

      await service.remove('uuid-1');

      expect(mockRepo.softDelete).toHaveBeenCalledWith('uuid-1');
    });

    it('should throw 404 when user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
