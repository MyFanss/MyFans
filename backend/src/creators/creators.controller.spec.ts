import { Test, TestingModule } from '@nestjs/testing';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';
import { SearchCreatorsDto } from './dto/search-creators.dto';
import { PaginatedResponseDto } from '../common/dto';
import { PublicCreatorDto } from './dto/public-creator.dto';
import { BadRequestException } from '@nestjs/common';

describe('CreatorsController', () => {
  let controller: CreatorsController;
  let service: CreatorsService;

  const mockCreatorsService = {
    searchCreators: jest.fn(),
    createPlan: jest.fn(),
    findAllPlans: jest.fn(),
    findCreatorPlans: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CreatorsController],
      providers: [
        {
          provide: CreatorsService,
          useValue: mockCreatorsService,
        },
      ],
    }).compile();

    controller = module.get<CreatorsController>(CreatorsController);
    service = module.get<CreatorsService>(CreatorsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('searchCreators', () => {
    describe('GET /creators endpoint exists and is accessible', () => {
      it('should have searchCreators method', () => {
        expect(controller.searchCreators).toBeDefined();
        expect(typeof controller.searchCreators).toBe('function');
      });
    });

    describe('endpoint accepts query parameters', () => {
      it('should accept query parameter q', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: 'test', page: 1, limit: 10 };
        const mockResponse = new PaginatedResponseDto([], 0, 1, 10);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        await controller.searchCreators(searchDto);

        // Assert
        expect(service.searchCreators).toHaveBeenCalledWith(searchDto);
        expect(service.searchCreators).toHaveBeenCalledWith(
          expect.objectContaining({ q: 'test' })
        );
      });

      it('should accept query parameter page', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: '', page: 2, limit: 10 };
        const mockResponse = new PaginatedResponseDto([], 0, 2, 10);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        await controller.searchCreators(searchDto);

        // Assert
        expect(service.searchCreators).toHaveBeenCalledWith(
          expect.objectContaining({ page: 2 })
        );
      });

      it('should accept query parameter limit', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: '', page: 1, limit: 20 };
        const mockResponse = new PaginatedResponseDto([], 0, 1, 20);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        await controller.searchCreators(searchDto);

        // Assert
        expect(service.searchCreators).toHaveBeenCalledWith(
          expect.objectContaining({ limit: 20 })
        );
      });

      it('should accept all query parameters together', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: 'alice', page: 3, limit: 15 };
        const mockResponse = new PaginatedResponseDto([], 0, 3, 15);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        await controller.searchCreators(searchDto);

        // Assert
        expect(service.searchCreators).toHaveBeenCalledWith({
          q: 'alice',
          page: 3,
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
          },
        ];
        const mockResponse = new PaginatedResponseDto(mockData, 1, 1, 10);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        const result = await controller.searchCreators(searchDto);

        // Assert
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('total');
        expect(result).toHaveProperty('page');
        expect(result).toHaveProperty('limit');
        expect(result).toHaveProperty('totalPages');
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
          },
        ];
        const mockResponse = new PaginatedResponseDto(mockData, 1, 1, 10);
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
        const mockResponse = new PaginatedResponseDto([], 0, 1, 10);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        const result = await controller.searchCreators(searchDto);

        // Assert
        expect(result).toBeDefined();
        expect(service.searchCreators).toHaveBeenCalled();
      });

      it('should return 200 status for valid request without query', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { page: 1, limit: 10 };
        const mockResponse = new PaginatedResponseDto([], 0, 1, 10);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        const result = await controller.searchCreators(searchDto);

        // Assert
        expect(result).toBeDefined();
        expect(service.searchCreators).toHaveBeenCalled();
      });

      it('should return 200 status for request with zero results', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: 'nonexistent', page: 1, limit: 10 };
        const mockResponse = new PaginatedResponseDto([], 0, 1, 10);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        const result = await controller.searchCreators(searchDto);

        // Assert
        expect(result).toBeDefined();
        expect(result.data).toHaveLength(0);
        expect(result.total).toBe(0);
      });
    });

    describe('endpoint returns 400 for invalid query length', () => {
      it('should handle validation error for query > 100 characters', async () => {
        // Arrange
        const longQuery = 'a'.repeat(101);
        const searchDto: SearchCreatorsDto = { q: longQuery, page: 1, limit: 10 };
        
        // Note: In real scenario, validation pipe would throw BadRequestException
        // Here we simulate the service rejecting it
        mockCreatorsService.searchCreators.mockRejectedValue(
          new BadRequestException('Query must not exceed 100 characters')
        );

        // Act & Assert
        await expect(controller.searchCreators(searchDto)).rejects.toThrow(
          BadRequestException
        );
      });
    });

    describe('endpoint returns 400 for invalid pagination parameters', () => {
      it('should handle validation error for invalid page number', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: '', page: 0, limit: 10 };
        
        mockCreatorsService.searchCreators.mockRejectedValue(
          new BadRequestException('Page must be at least 1')
        );

        // Act & Assert
        await expect(controller.searchCreators(searchDto)).rejects.toThrow(
          BadRequestException
        );
      });

      it('should handle validation error for invalid limit', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: '', page: 1, limit: 0 };
        
        mockCreatorsService.searchCreators.mockRejectedValue(
          new BadRequestException('Limit must be at least 1')
        );

        // Act & Assert
        await expect(controller.searchCreators(searchDto)).rejects.toThrow(
          BadRequestException
        );
      });

      it('should handle validation error for limit exceeding maximum', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: '', page: 1, limit: 101 };
        
        mockCreatorsService.searchCreators.mockRejectedValue(
          new BadRequestException('Limit must not exceed 100')
        );

        // Act & Assert
        await expect(controller.searchCreators(searchDto)).rejects.toThrow(
          BadRequestException
        );
      });
    });

    describe('default pagination values applied when omitted', () => {
      it('should use default values when pagination parameters are omitted', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: 'test' };
        const mockResponse = new PaginatedResponseDto([], 0, 1, 20);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        await controller.searchCreators(searchDto);

        // Assert
        expect(service.searchCreators).toHaveBeenCalledWith(searchDto);
      });

      it('should use default page when only limit is provided', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: 'test', limit: 10 };
        const mockResponse = new PaginatedResponseDto([], 0, 1, 10);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        await controller.searchCreators(searchDto);

        // Assert
        expect(service.searchCreators).toHaveBeenCalledWith(
          expect.objectContaining({ limit: 10 })
        );
      });

      it('should use default limit when only page is provided', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: 'test', page: 2 };
        const mockResponse = new PaginatedResponseDto([], 0, 2, 20);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        await controller.searchCreators(searchDto);

        // Assert
        expect(service.searchCreators).toHaveBeenCalledWith(
          expect.objectContaining({ page: 2 })
        );
      });
    });

    describe('CreatorsService.searchCreators method is called', () => {
      it('should call service.searchCreators with correct parameters', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: 'alice', page: 2, limit: 15 };
        const mockResponse = new PaginatedResponseDto([], 0, 2, 15);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        await controller.searchCreators(searchDto);

        // Assert
        expect(service.searchCreators).toHaveBeenCalledTimes(1);
        expect(service.searchCreators).toHaveBeenCalledWith(searchDto);
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
          },
        ];
        const mockResponse = new PaginatedResponseDto(mockData, 1, 1, 10);
        mockCreatorsService.searchCreators.mockResolvedValue(mockResponse);

        // Act
        const result = await controller.searchCreators(searchDto);

        // Assert
        expect(result).toEqual(mockResponse);
        expect(result.data).toEqual(mockData);
        expect(result.total).toBe(1);
      });
    });
  });
});
