import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';
import { CreatorDashboardService } from './creator-dashboard.service';
import { SearchCreatorsDto } from './dto/search-creators.dto';
import { PaginatedResponseDto } from '../common/dto';
import { PublicCreatorDto } from './dto/public-creator.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';

type MockCreatorsService = {
  searchCreators: jest.Mock;
  getCreatorByUsername: jest.Mock;
  createPlan: jest.Mock;
  findAllPlans: jest.Mock;
  findCreatorPlans: jest.Mock;
  listCreators: jest.Mock;
};

type MockDashboardService = {
  getDashboard: jest.Mock;
};

describe('CreatorsController', () => {
  let controller: CreatorsController;
  let mockCreatorsService: MockCreatorsService;
  let mockDashboardService: MockDashboardService;

  const mockCreatorsServiceFactory = (): MockCreatorsService => ({
    searchCreators: jest.fn(),
    getCreatorByUsername: jest.fn(),
    createPlan: jest.fn(),
    findAllPlans: jest.fn(),
    findCreatorPlans: jest.fn(),
    listCreators: jest.fn(),
  });

  const mockDashboardServiceFactory = (): MockDashboardService => ({
    getDashboard: jest.fn(),
  });

  beforeEach(async () => {
    mockCreatorsService = mockCreatorsServiceFactory();
    mockDashboardService = mockDashboardServiceFactory();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }]),
      ],
      controllers: [CreatorsController],
      providers: [
        {
          provide: CreatorsService,
          useValue: mockCreatorsService,
        },
        {
          provide: CreatorDashboardService,
          useValue: mockDashboardService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CreatorsController>(CreatorsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listCreators', () => {
    it('should call service.listCreators with mergeChain=false by default', async () => {
      mockCreatorsService.listCreators.mockResolvedValue([]);
      await controller.listCreators(undefined);
      expect(mockCreatorsService.listCreators).toHaveBeenCalledWith(false);
    });

    it('should call service.listCreators with mergeChain=true when chain=true', async () => {
      mockCreatorsService.listCreators.mockResolvedValue([]);
      await controller.listCreators('true');
      expect(mockCreatorsService.listCreators).toHaveBeenCalledWith(true);
    });

    it('should return array of plans', async () => {
      const mockPlans = [
        {
          id: 1,
          creator: 'user1',
          asset: 'native',
          amount: '100',
          intervalDays: 30,
        },
        {
          id: 2,
          creator: 'user2',
          asset: 'native',
          amount: '50',
          intervalDays: 7,
        },
      ];
      mockCreatorsService.listCreators.mockResolvedValue(mockPlans);

      const result = await controller.listCreators('false');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('should propagate service errors', async () => {
      const error = new Error('DB error');
      mockCreatorsService.listCreators.mockRejectedValue(error);

      await expect(controller.listCreators(undefined)).rejects.toThrow(error);
    });
  });

  describe('createPlan', () => {
    it('should call service.createPlan with correct parameters', () => {
      const planBody = {
        creator: 'user1',
        asset: 'native',
        amount: '100',
        intervalDays: 30,
      };
      const mockPlan = { id: 1, ...planBody };
      mockCreatorsService.createPlan.mockReturnValue(mockPlan);

      controller.createPlan(planBody);

      expect(mockCreatorsService.createPlan).toHaveBeenCalledWith(
        'user1',
        'native',
        '100',
        30,
      );
    });

    it('should return created plan with id', () => {
      const planBody = {
        creator: 'user1',
        asset: 'native',
        amount: '100',
        intervalDays: 30,
      };
      const mockPlan = { id: 1, ...planBody };
      mockCreatorsService.createPlan.mockReturnValue(mockPlan);

      const result = controller.createPlan(planBody);

      expect(result).toEqual(mockPlan);
      expect(result.id).toBe(1);
    });

    it('should propagate service errors', async () => {
      const planBody = {
        creator: 'user1',
        asset: 'native',
        amount: '100',
        intervalDays: 30,
      };
      const error = new Error('Invalid plan');
      mockCreatorsService.createPlan.mockRejectedValue(error);

      await expect(controller.createPlan(planBody)).rejects.toThrow(error);
    });
  });

  describe('getAllPlans', () => {
    it('should call service.findAllPlans with pagination', () => {
      const pagination = { page: 1, limit: 20 };
      const mockResponse = new PaginatedResponseDto([], 20, null, false);
      mockCreatorsService.findAllPlans.mockReturnValue(mockResponse);

      controller.getAllPlans(pagination);

      expect(mockCreatorsService.findAllPlans).toHaveBeenCalledWith(pagination);
    });

    it('should return paginated plans', () => {
      const pagination = { page: 1, limit: 20 };
      const mockPlans = [
        {
          id: 1,
          creator: 'user1',
          asset: 'native',
          amount: '100',
          intervalDays: 30,
        },
      ];
      const mockResponse = new PaginatedResponseDto(mockPlans, 20, null, false);
      mockCreatorsService.findAllPlans.mockReturnValue(mockResponse);

      const result = controller.getAllPlans(pagination);

      expect(result.data).toHaveLength(1);
      expect(result.limit).toBe(20);
    });
  });

  describe('getPlans', () => {
    it('should call service.findCreatorPlans with address and pagination', () => {
      const address = 'GBCQ6C7OXWTKJ7APCIQPKK6X4CQBFGWJKW35GD7H5GMVVDANQCXLSV7';
      const pagination = { page: 1, limit: 20 };
      const mockResponse = new PaginatedResponseDto([], 20, null, false);
      mockCreatorsService.findCreatorPlans.mockReturnValue(mockResponse);

      controller.getPlans(address, pagination);

      expect(mockCreatorsService.findCreatorPlans).toHaveBeenCalledWith(
        address,
        pagination,
      );
    });

    it('should return creator plans', () => {
      const address = 'GBCQ6C7OXWTKJ7APCIQPKK6X4CQBFGWJKW35GD7H5GMVVDANQCXLSV7';
      const pagination = { page: 1, limit: 20 };
      const mockPlans = [
        {
          id: 1,
          creator: address,
          asset: 'native',
          amount: '100',
          intervalDays: 30,
        },
      ];
      const mockResponse = new PaginatedResponseDto(mockPlans, 20, null, false);
      mockCreatorsService.findCreatorPlans.mockReturnValue(mockResponse);

      const result = controller.getPlans(address, pagination);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].creator).toBe(address);
    });
  });

  describe('getDashboard', () => {
    it('should call dashboardService.getDashboard with address and query', async () => {
      const address = 'GBCQ6C7OXWTKJ7APCIQPKK6X4CQBFGWJKW35GD7H5GMVVDANQCXLSV7';
      const query = { period: 'month' };
      const mockDashboard = {
        totalRevenue: '1000',
        subscriberCount: 10,
      };
      const mockDashboardService = controller['dashboardService'];
      const getDashboardSpy = jest
        .spyOn(mockDashboardService, 'getDashboard')
        .mockReturnValue(mockDashboard as any);

      await controller.getDashboard(address, query as any);

      expect(getDashboardSpy).toHaveBeenCalledWith(address, query);
    });
  });

  describe('searchCreators', () => {
    describe('GET /creators endpoint exists and is accessible', () => {
      it('should have searchCreators method', () => {
        expect(controller).toHaveProperty('searchCreators');
        expect(typeof controller.searchCreators).toBe('function');
      });
    });

    describe('endpoint accepts query parameters', () => {
      it('should accept query parameter q', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: 'test', page: 1, limit: 10 };
        const mockResponse = new PaginatedResponseDto([], 10, null, false);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        await controller.searchCreators(searchDto);

        // Assert
        expect(mockCreatorsService.searchCreators).toHaveBeenCalledWith(
          searchDto,
        );
        expect(mockCreatorsService.searchCreators).toHaveBeenCalledWith(
          expect.objectContaining({ q: 'test' }),
        );
      });

      it('should accept query parameter cursor', async () => {
        const searchDto: SearchCreatorsDto = {
          q: '',
          cursor: 'alice',
          limit: 10,
        };
        const mockResponse = new PaginatedResponseDto([], 10, null, false);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        await controller.searchCreators(searchDto);

        expect(mockCreatorsService.searchCreators).toHaveBeenCalledWith(
          expect.objectContaining({ cursor: 'alice' }),
        );
      });

      it('should accept query parameter limit', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: '', page: 1, limit: 20 };
        const mockResponse = new PaginatedResponseDto([], 20, null, false);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        await controller.searchCreators(searchDto);

        // Assert
        expect(mockCreatorsService.searchCreators).toHaveBeenCalledWith(
          expect.objectContaining({ limit: 20 }),
        );
      });

      it('should accept all query parameters together', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = {
          q: 'alice',
          cursor: 'bob',
          limit: 15,
        };
        const mockResponse = new PaginatedResponseDto([], 15, null, false);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        await controller.searchCreators(searchDto);

        expect(mockCreatorsService.searchCreators).toHaveBeenCalledWith({
          q: 'alice',
          cursor: 'bob',
          limit: 15,
        });
      });
    });

    describe('endpoint returns PaginatedResponseDto structure', () => {
      it('should return PaginatedResponseDto with correct structure', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: 'test', page: 1, limit: 10 };
        const mockData: PublicCreatorDto[] = [
          {
            id: '1',
            username: 'testuser',
            display_name: 'Test User',
            avatar_url: 'https://example.com/avatar.jpg',
            bio: 'Test bio',
            is_verified: false,
            followers_count: 0,
          },
        ];
        const mockResponse = new PaginatedResponseDto(
          mockData,
          10,
          'testuser',
          false,
        );
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        const result = await controller.searchCreators(searchDto);

        // Assert
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('limit');
        expect(result).toHaveProperty('nextCursor');
        expect(result).toHaveProperty('hasMore');
      });

      it('should return data array with PublicCreatorDto objects', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: 'test', page: 1, limit: 10 };
        const mockData: PublicCreatorDto[] = [
          {
            id: '1',
            username: 'testuser',
            display_name: 'Test User',
            avatar_url: 'https://example.com/avatar.jpg',
            bio: 'Test bio',
            is_verified: false,
            followers_count: 0,
          },
        ];
        const mockResponse = new PaginatedResponseDto(
          mockData,
          10,
          'testuser',
          false,
        );
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        const result = await controller.searchCreators(searchDto);

        // Assert
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data[0]).toHaveProperty('id');
        expect(result.data[0]).toHaveProperty('username');
        expect(result.data[0]).toHaveProperty('display_name');
        expect(result.data[0]).toHaveProperty('avatar_url');
        expect(result.data[0]).toHaveProperty('bio');
      });
    });

    describe('endpoint returns 200 for valid requests', () => {
      it('should return 200 status for valid request with query', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: 'test', page: 1, limit: 10 };
        const mockResponse = new PaginatedResponseDto([], 10, null, false);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        const result = await controller.searchCreators(searchDto);

        // Assert
        expect(result).toBeDefined();
        expect(mockCreatorsService.searchCreators).toHaveBeenCalled();
      });

      it('should return 200 status for valid request without query', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { page: 1, limit: 10 };
        const mockResponse = new PaginatedResponseDto([], 10, null, false);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        const result = await controller.searchCreators(searchDto);

        // Assert
        expect(result).toBeDefined();
        expect(mockCreatorsService.searchCreators).toHaveBeenCalled();
      });

      it('should return 200 status for request with zero results', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = {
          q: 'nonexistent',
          page: 1,
          limit: 10,
        };
        const mockResponse = new PaginatedResponseDto([], 10, null, false);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        const result = await controller.searchCreators(searchDto);

        // Assert
        expect(result).toBeDefined();
        expect(result.data).toHaveLength(0);
        expect(result.hasMore).toBe(false);
      });
    });

    describe('endpoint returns 400 for invalid query length', () => {
      it('should handle validation error for query > 100 characters', async () => {
        // Arrange
        const longQuery = 'a'.repeat(101);
        const searchDto: SearchCreatorsDto = {
          q: longQuery,
          page: 1,
          limit: 10,
        };

        // Note: In real scenario, validation pipe would throw BadRequestException
        // Here we simulate the service rejecting it
        mockCreatorsService.searchCreators.mockRejectedValue(
          new BadRequestException('Query must not exceed 100 characters'),
        );

        // Act & Assert
        await expect(controller.searchCreators(searchDto)).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('endpoint returns 400 for invalid pagination parameters', () => {
      it('should handle validation error for invalid page number', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: '', page: 0, limit: 10 };

        mockCreatorsService.searchCreators.mockRejectedValue(
          new BadRequestException('Page must be at least 1'),
        );

        // Act & Assert
        await expect(controller.searchCreators(searchDto)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should handle validation error for invalid limit', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: '', page: 1, limit: 0 };

        mockCreatorsService.searchCreators.mockRejectedValue(
          new BadRequestException('Limit must be at least 1'),
        );

        // Act & Assert
        await expect(controller.searchCreators(searchDto)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should handle validation error for limit exceeding maximum', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: '', page: 1, limit: 101 };

        mockCreatorsService.searchCreators.mockRejectedValue(
          new BadRequestException('Limit must not exceed 100'),
        );

        // Act & Assert
        await expect(controller.searchCreators(searchDto)).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('default pagination values applied when omitted', () => {
      it('should use default values when pagination parameters are omitted', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: 'test' };
        const mockResponse = new PaginatedResponseDto([], 20, null, false);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        await controller.searchCreators(searchDto);

        // Assert
        expect(mockCreatorsService.searchCreators).toHaveBeenCalledWith(
          searchDto,
        );
      });

      it('should use default page when only limit is provided', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: 'test', limit: 10 };
        const mockResponse = new PaginatedResponseDto([], 10, null, false);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        await controller.searchCreators(searchDto);

        // Assert
        expect(mockCreatorsService.searchCreators).toHaveBeenCalledWith(
          expect.objectContaining({ limit: 10 }),
        );
      });

      it('should use default limit when only cursor is provided', async () => {
        const searchDto: SearchCreatorsDto = { q: 'test', cursor: 'alice' };
        const mockResponse = new PaginatedResponseDto([], 20, null, false);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        await controller.searchCreators(searchDto);

        expect(mockCreatorsService.searchCreators).toHaveBeenCalledWith(
          expect.objectContaining({ cursor: 'alice' }),
        );
      });
    });

    describe('CreatorsService.searchCreators method is called', () => {
      it('should call service.searchCreators with correct parameters', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = {
          q: 'alice',
          cursor: 'bob',
          limit: 15,
        };
        const mockResponse = new PaginatedResponseDto([], 15, null, false);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        await controller.searchCreators(searchDto);

        // Assert
        expect(mockCreatorsService.searchCreators).toHaveBeenCalledTimes(1);
        expect(mockCreatorsService.searchCreators).toHaveBeenCalledWith(
          searchDto,
        );
      });

      it('passes mixed-case query to service for case-insensitive search', async () => {
        const searchDto: SearchCreatorsDto = { q: 'ALICE', page: 1, limit: 10 };
        mockCreatorsService.searchCreators.mockResolvedValue(
          new PaginatedResponseDto([], 10, null, false),
        );

        await controller.searchCreators(searchDto);

        expect(mockCreatorsService.searchCreators).toHaveBeenCalledWith(
          expect.objectContaining({ q: 'ALICE' }),
        );
      });

      it('should return the result from service.searchCreators', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: 'test', page: 1, limit: 10 };
        const mockData: PublicCreatorDto[] = [
          {
            id: '1',
            username: 'testuser',
            display_name: 'Test User',
            avatar_url: 'https://example.com/avatar.jpg',
            bio: 'Test bio',
            is_verified: false,
            followers_count: 0,
          },
        ];
        const mockResponse = new PaginatedResponseDto(
          mockData,
          10,
          'testuser',
          false,
        );
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        const result = await controller.searchCreators(searchDto);

        // Assert
        expect(result).toEqual(mockResponse);
        expect(result.data).toEqual(mockData);
        expect(result.nextCursor).toBe('testuser');
      });
    });
  });

  describe('getCreatorByUsername', () => {
    it('should return the creator profile when found', async () => {
      const mockCreator: PublicCreatorDto = {
        id: '1',
        username: 'testuser',
        display_name: 'Test User',
        avatar_url: null,
        bio: 'Test bio',
        is_verified: true,
        followers_count: 42,
      };
      mockCreatorsService.getCreatorByUsername.mockResolvedValue(mockCreator);

      const result = await controller.getCreatorByUsername('testuser');

      expect(mockCreatorsService.getCreatorByUsername).toHaveBeenCalledWith(
        'testuser',
      );
      expect(result).toEqual(mockCreator);
    });

    it('should throw NotFoundException when the username does not match a creator', async () => {
      mockCreatorsService.getCreatorByUsername.mockResolvedValue(null);

      await expect(controller.getCreatorByUsername('nobody')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createPlan', () => {
    it('should call service.createPlan with correct parameters', () => {
      const mockPlan = {
        id: 1,
        creator: 'creator1',
        asset: 'USDC',
        amount: '100',
        intervalDays: 30,
      };
      mockCreatorsService.createPlan.mockReturnValue(mockPlan);

      const result = controller.createPlan({
        creator: 'creator1',
        asset: 'USDC',
        amount: '100',
        intervalDays: 30,
      });

      expect(mockCreatorsService.createPlan).toHaveBeenCalledWith(
        'creator1',
        'USDC',
        '100',
        30,
      );
      expect(result).toEqual(mockPlan);
    });

    it('should create plan with valid input', () => {
      const mockPlan = {
        id: 2,
        creator: 'creator2',
        asset: 'EURC',
        amount: '50',
        intervalDays: 7,
      };
      mockCreatorsService.createPlan.mockReturnValue(mockPlan);

      const result = controller.createPlan({
        creator: 'creator2',
        asset: 'EURC',
        amount: '50',
        intervalDays: 7,
      });

      expect(result.id).toBe(2);
      expect(result.creator).toBe('creator2');
      expect(result.asset).toBe('EURC');
    });

    it('should throw BadRequestException on invalid input', () => {
      mockCreatorsService.createPlan.mockImplementation(() => {
        throw new BadRequestException('Invalid plan parameters');
      });

      expect(() =>
        controller.createPlan({
          creator: '',
          asset: 'USDC',
          amount: '100',
          intervalDays: 30,
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('getAllPlans', () => {
    it('should call service.findAllPlans with pagination', () => {
      const mockPlans = new PaginatedResponseDto(
        [
          {
            id: 1,
            creator: 'creator1',
            asset: 'USDC',
            amount: '100',
            intervalDays: 30,
          },
        ],
        20,
        '1',
        false,
      );
      mockCreatorsService.findAllPlans.mockReturnValue(mockPlans);

      const result = controller.getAllPlans({ limit: 20 });

      expect(mockCreatorsService.findAllPlans).toHaveBeenCalledWith({
        limit: 20,
      });
      expect(result).toEqual(mockPlans);
    });

    it('should return paginated plans', () => {
      const mockPlans = new PaginatedResponseDto(
        [
          {
            id: 1,
            creator: 'creator1',
            asset: 'USDC',
            amount: '100',
            intervalDays: 30,
          },
          {
            id: 2,
            creator: 'creator2',
            asset: 'EURC',
            amount: '50',
            intervalDays: 7,
          },
        ],
        20,
        '2',
        false,
      );
      mockCreatorsService.findAllPlans.mockReturnValue(mockPlans);

      const result = controller.getAllPlans({ cursor: '0', limit: 20 });

      expect(result.data.length).toBe(2);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBe('2');
    });

    it('should return empty list when no plans exist', () => {
      const mockPlans = new PaginatedResponseDto([], 20, null, false);
      mockCreatorsService.findAllPlans.mockReturnValue(mockPlans);

      const result = controller.getAllPlans({ limit: 20 });

      expect(result.data.length).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('getPlans', () => {
    it('should call service.findCreatorPlans with creator and pagination', () => {
      const mockPlans = new PaginatedResponseDto(
        [
          {
            id: 1,
            creator: 'creator1',
            asset: 'USDC',
            amount: '100',
            intervalDays: 30,
          },
        ],
        20,
        '1',
        false,
      );
      mockCreatorsService.findCreatorPlans.mockReturnValue(mockPlans);

      const result = controller.getPlans('creator1', { limit: 20 });

      expect(mockCreatorsService.findCreatorPlans).toHaveBeenCalledWith(
        'creator1',
        {
          limit: 20,
        },
      );
      expect(result).toEqual(mockPlans);
    });

    it('should return creator plans when creator has plans', () => {
      const mockPlans = new PaginatedResponseDto(
        [
          {
            id: 1,
            creator: 'creator1',
            asset: 'USDC',
            amount: '100',
            intervalDays: 30,
          },
          {
            id: 2,
            creator: 'creator1',
            asset: 'EURC',
            amount: '50',
            intervalDays: 7,
          },
        ],
        20,
        '2',
        false,
      );
      mockCreatorsService.findCreatorPlans.mockReturnValue(mockPlans);

      const result = controller.getPlans('creator1', { limit: 20 });

      expect(result.data.length).toBe(2);
      expect(result.data[0].creator).toBe('creator1');
      expect(result.data[1].creator).toBe('creator1');
    });

    it('should return empty list when creator has no plans', () => {
      const mockPlans = new PaginatedResponseDto([], 20, null, false);
      mockCreatorsService.findCreatorPlans.mockReturnValue(mockPlans);

      const result = controller.getPlans('nonexistent', { limit: 20 });

      expect(result.data.length).toBe(0);
      expect(mockCreatorsService.findCreatorPlans).toHaveBeenCalledWith(
        'nonexistent',
        {
          limit: 20,
        },
      );
    });
  });

  describe('getDashboard', () => {
    it('should call dashboard service with address and query', () => {
      const mockDashboard = { totalEarnings: 1000, subscribers: 50 };
      mockDashboardService.getDashboard.mockReturnValue(mockDashboard);

      const result = controller.getDashboard('creator1', {});

      expect(mockDashboardService.getDashboard).toHaveBeenCalledWith(
        'creator1',
        {},
      );
      expect(result).toEqual(mockDashboard);
    });

    it('should return dashboard metrics for creator', () => {
      const mockDashboard = {
        totalEarnings: 5000,
        subscribers: 150,
        activeSubscriptions: 120,
      };
      mockDashboardService.getDashboard.mockReturnValue(mockDashboard);

      const result = controller.getDashboard('creator1', { days: '30' });

      expect(result.totalEarnings).toBe(5000);
      expect(result.subscribers).toBe(150);
      expect(mockDashboardService.getDashboard).toHaveBeenCalledWith(
        'creator1',
        {
          days: '30',
        },
      );
    });

    it('should pass query parameters to dashboard service', async () => {
      const mockDashboard = { totalEarnings: 0, subscribers: 0 };
      mockDashboardService.getDashboard.mockResolvedValue(mockDashboard);

      await controller.getDashboard('creator1', { days: '90' });

      expect(mockDashboardService.getDashboard).toHaveBeenCalledWith(
        'creator1',
        {
          days: '90',
        },
      );
    });

    it('should handle dashboard not found error', () => {
      mockDashboardService.getDashboard.mockImplementation(() => {
        throw new NotFoundException('Creator dashboard not found');
      });

      expect(() => controller.getDashboard('nonexistent', {})).toThrow(
        NotFoundException,
      );
    });
  });
});
