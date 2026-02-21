import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserProfileDto, PaginationDto } from './dto/user-profile.dto';

const mockProfile = (): UserProfileDto => ({
  id: 'uuid-1',
  email: 'john@example.com',
  username: 'johndoe',
  firstName: 'John',
  lastName: 'Doe',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
});

describe('UsersController', () => {
  let controller: UsersController;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a user and return profile', async () => {
      const dto: CreateUserDto = {
        email: 'john@example.com',
        username: 'johndoe',
        password: 'SecurePass123!',
      };
      mockService.create.mockResolvedValue(mockProfile());

      const result = await controller.create(dto);

      expect(result.id).toBe('uuid-1');
      expect(mockService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const pagination: PaginationDto = { page: 1, limit: 10 };
      const expected = { data: [mockProfile()], total: 1, page: 1, limit: 10, totalPages: 1 };
      mockService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(pagination);

      expect(result.data).toHaveLength(1);
      expect(mockService.findAll).toHaveBeenCalledWith(pagination);
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      mockService.findOne.mockResolvedValue(mockProfile());

      const result = await controller.findOne('uuid-1');

      expect(result.id).toBe('uuid-1');
      expect(mockService.findOne).toHaveBeenCalledWith('uuid-1');
    });
  });

  describe('update', () => {
    it('should update and return the user', async () => {
      const dto: UpdateUserDto = { firstName: 'Jane' };
      mockService.update.mockResolvedValue({ ...mockProfile(), firstName: 'Jane' });

      const result = await controller.update('uuid-1', dto);

      expect(result.firstName).toBe('Jane');
      expect(mockService.update).toHaveBeenCalledWith('uuid-1', dto);
    });
  });

  describe('remove', () => {
    it('should remove the user', async () => {
      mockService.remove.mockResolvedValue(undefined);

      await controller.remove('uuid-1');

      expect(mockService.remove).toHaveBeenCalledWith('uuid-1');
    });
  });
});
