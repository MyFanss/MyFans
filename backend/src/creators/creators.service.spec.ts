import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SelectQueryBuilder } from 'typeorm';
import { CreatorsService } from './creators.service';
import { PaginationDto } from '../common/dto';
import { User } from '../users/entities/user.entity';
import { EventBus } from '../events/event-bus';
import { SearchCreatorsDto } from './dto/search-creators.dto';
import { UserRole } from '../common/enums/user-role.enum';

describe('CreatorsService', () => {
  let service: CreatorsService;
  let mockQueryBuilder: Partial<SelectQueryBuilder<User>>;
  let debugSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(async () => {
    debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    // Create mock query builder
    mockQueryBuilder = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getCount: jest.fn(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawAndEntities: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorsService,
        { provide: EventBus, useValue: { publish: jest.fn() } },
        {
          provide: getRepositoryToken(User),
          useValue: {
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get<CreatorsService>(CreatorsService);
  });

  afterEach(() => {
    debugSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchCreators', () => {
    describe('empty query returns all creators with pagination', () => {
      it('should return all creators when query is empty string', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: '', page: 1, limit: 10 };
        const mockUsers: User[] = [
          createMockUser('1', 'alice', 'Alice Smith'),
          createMockUser('2', 'bob', 'Bob Jones'),
        ];

        (mockQueryBuilder.getCount as jest.Mock).mockResolvedValue(2);
        (mockQueryBuilder.getRawAndEntities as jest.Mock).mockResolvedValue({
          entities: mockUsers,
          raw: [{ creator_bio: 'Alice bio' }, { creator_bio: 'Bob bio' }],
        });

        // Act
        const result = await service.searchCreators(searchDto);

        // Assert
        expect(result.data).toHaveLength(2);
        expect(result.limit).toBe(10);
        expect(result.hasMore).toBe(false);
        expect(result.nextCursor).toBe('bob');
        expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
        expect(debugSpy).toHaveBeenCalledWith(
          'Creator search returned 2 rows for query ""',
        );
      });

      it('should return all creators when query is undefined', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { page: 1, limit: 10 };
        const mockUsers: User[] = [createMockUser('1', 'alice', 'Alice Smith')];

        (mockQueryBuilder.getCount as jest.Mock).mockResolvedValue(1);
        (mockQueryBuilder.getRawAndEntities as jest.Mock).mockResolvedValue({
          entities: mockUsers,
          raw: [{ creator_bio: 'Alice bio' }],
        });

        // Act
        const result = await service.searchCreators(searchDto);

        // Assert
        expect(result.data).toHaveLength(1);
        expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
      });
    });

    describe('query with no matches returns empty data array', () => {
      it('should return empty results when no creators match', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = {
          q: 'nonexistent',
          limit: 10,
        };

        (mockQueryBuilder.getRawAndEntities as jest.Mock).mockResolvedValue({
          entities: [],
          raw: [],
        });

        // Act
        const result = await service.searchCreators(searchDto);

        // Assert
        expect(result.data).toHaveLength(0);
        expect(result.nextCursor).toBeNull();
        expect(result.hasMore).toBe(false);
        expect(result.limit).toBe(10);
      });
    });

    describe('query matching display_name returns correct creators', () => {
      it('should return creators matching display_name prefix', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: 'Alice', page: 1, limit: 10 };
        const mockUsers: User[] = [
          createMockUser('1', 'alice123', 'Alice Smith'),
          createMockUser('2', 'alice456', 'Alice Johnson'),
        ];

        (mockQueryBuilder.getCount as jest.Mock).mockResolvedValue(2);
        (mockQueryBuilder.getRawAndEntities as jest.Mock).mockResolvedValue({
          entities: mockUsers,
          raw: [{ creator_bio: 'Bio 1' }, { creator_bio: 'Bio 2' }],
        });

        // Act
        const result = await service.searchCreators(searchDto);

        // Assert
        expect(result.data).toHaveLength(2);
        expect(result.data[0].display_name).toBe('Alice Smith');
        expect(result.data[1].display_name).toBe('Alice Johnson');
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
          '(LOWER(user.display_name) LIKE :search OR LOWER(user.username) LIKE :search)',
          { search: 'alice%' },
        );
      });
    });

    describe('query matching username returns correct creators', () => {
      it('should return creators matching username prefix', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: 'bob', page: 1, limit: 10 };
        const mockUsers: User[] = [
          createMockUser('1', 'bob123', 'Robert Smith'),
          createMockUser('2', 'bobby', 'Bobby Jones'),
        ];

        (mockQueryBuilder.getCount as jest.Mock).mockResolvedValue(2);
        (mockQueryBuilder.getRawAndEntities as jest.Mock).mockResolvedValue({
          entities: mockUsers,
          raw: [{ creator_bio: 'Bio 1' }, { creator_bio: 'Bio 2' }],
        });

        // Act
        const result = await service.searchCreators(searchDto);

        // Assert
        expect(result.data).toHaveLength(2);
        expect(result.data[0].username).toBe('bob123');
        expect(result.data[1].username).toBe('bobby');
      });
    });

    describe('query matching both display_name and username returns all matches', () => {
      it('should return all creators matching either display_name or username', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: 'john', page: 1, limit: 10 };
        const mockUsers: User[] = [
          createMockUser('1', 'john_doe', 'John Smith'),
          createMockUser('2', 'alice', 'Johnny Walker'),
          createMockUser('3', 'johnsmith', 'Bob Jones'),
        ];

        (mockQueryBuilder.getCount as jest.Mock).mockResolvedValue(3);
        (mockQueryBuilder.getRawAndEntities as jest.Mock).mockResolvedValue({
          entities: mockUsers,
          raw: [
            { creator_bio: 'Bio 1' },
            { creator_bio: 'Bio 2' },
            { creator_bio: 'Bio 3' },
          ],
        });

        // Act
        const result = await service.searchCreators(searchDto);

        // Assert
        expect(result.data).toHaveLength(3);
      });
    });

    describe('search query alias', () => {
      it('should filter when only search param is provided', async () => {
        const searchDto: SearchCreatorsDto = { search: 'bob', page: 1, limit: 10 };
        const mockUsers: User[] = [createMockUser('1', 'bob123', 'Bob Smith')];

        (mockQueryBuilder.getCount as jest.Mock).mockResolvedValue(1);
        (mockQueryBuilder.getRawAndEntities as jest.Mock).mockResolvedValue({
          entities: mockUsers,
          raw: [{ creator_bio: 'Bio' }],
        });

        await service.searchCreators(searchDto);

        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
          '(LOWER(user.display_name) LIKE :search OR LOWER(user.username) LIKE :search)',
          { search: 'bob%' },
        );
      });
    });

    describe('case-insensitive matching', () => {
      it('should match uppercase query', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: 'ALICE', page: 1, limit: 10 };
        const mockUsers: User[] = [createMockUser('1', 'alice', 'Alice Smith')];

        (mockQueryBuilder.getCount as jest.Mock).mockResolvedValue(1);
        (mockQueryBuilder.getRawAndEntities as jest.Mock).mockResolvedValue({
          entities: mockUsers,
          raw: [{ creator_bio: 'Bio' }],
        });

        // Act
        const result = await service.searchCreators(searchDto);

        // Assert
        expect(result.data).toHaveLength(1);
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
          '(LOWER(user.display_name) LIKE :search OR LOWER(user.username) LIKE :search)',
          { search: 'alice%' },
        );
      });

      it('should match lowercase query', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: 'alice', page: 1, limit: 10 };
        const mockUsers: User[] = [createMockUser('1', 'ALICE', 'ALICE SMITH')];

        (mockQueryBuilder.getCount as jest.Mock).mockResolvedValue(1);
        (mockQueryBuilder.getRawAndEntities as jest.Mock).mockResolvedValue({
          entities: mockUsers,
          raw: [{ creator_bio: 'Bio' }],
        });

        // Act
        const result = await service.searchCreators(searchDto);

        // Assert
        expect(result.data).toHaveLength(1);
      });

      it('should match mixed case query', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: 'AlIcE', page: 1, limit: 10 };
        const mockUsers: User[] = [createMockUser('1', 'alice', 'Alice Smith')];

        (mockQueryBuilder.getCount as jest.Mock).mockResolvedValue(1);
        (mockQueryBuilder.getRawAndEntities as jest.Mock).mockResolvedValue({
          entities: mockUsers,
          raw: [{ creator_bio: 'Bio' }],
        });

        // Act
        const result = await service.searchCreators(searchDto);

        // Assert
        expect(result.data).toHaveLength(1);
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
          '(LOWER(user.display_name) LIKE :search OR LOWER(user.username) LIKE :search)',
          { search: 'alice%' },
        );
      });
    });

    describe('pagination', () => {
      it('should apply cursor filter for the second page', async () => {
        const searchDto: SearchCreatorsDto = { q: '', cursor: 'user10', limit: 10 };
        const mockUsers: User[] = [createMockUser('11', 'user11', 'User 11')];

        (mockQueryBuilder.getRawAndEntities as jest.Mock).mockResolvedValue({
          entities: mockUsers,
          raw: [{ creator_bio: 'Bio' }],
        });

        await service.searchCreators(searchDto);

        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
          'user.username > :cursorUsername',
          { cursorUsername: 'user10' },
        );
        expect(mockQueryBuilder.take).toHaveBeenCalledWith(11);
      });

      it('should respect pagination limit', async () => {
        const searchDto: SearchCreatorsDto = { q: '', limit: 5 };
        const mockUsers: User[] = Array.from({ length: 6 }, (_, i) =>
          createMockUser(`${i}`, `user${i}`, `User ${i}`),
        );

        (mockQueryBuilder.getRawAndEntities as jest.Mock).mockResolvedValue({
          entities: mockUsers,
          raw: mockUsers.map(() => ({ creator_bio: 'Bio' })),
        });

        const result = await service.searchCreators(searchDto);

        expect(result.data).toHaveLength(5);
        expect(result.limit).toBe(5);
        expect(result.hasMore).toBe(true);
        expect(result.nextCursor).toBe('user4');
        expect(mockQueryBuilder.take).toHaveBeenCalledWith(6);
      });

      it('should return nextCursor on the first page when more results exist', async () => {
        const searchDto: SearchCreatorsDto = { q: 'test', limit: 1 };
        const mockUsers: User[] = [
          createMockUser('1', 'test1', 'Test User 1'),
          createMockUser('2', 'test2', 'Test User 2'),
        ];

        (mockQueryBuilder.getRawAndEntities as jest.Mock).mockResolvedValue({
          entities: mockUsers,
          raw: [{ creator_bio: 'Bio' }, { creator_bio: 'Bio 2' }],
        });

        const result = await service.searchCreators(searchDto);

        expect(result.data).toHaveLength(1);
        expect(result.nextCursor).toBe('test1');
        expect(result.hasMore).toBe(true);
      });

      it('should return empty data for stale cursor beyond results', async () => {
        const searchDto: SearchCreatorsDto = { q: '', cursor: 'zzzzz', limit: 10 };

        (mockQueryBuilder.getRawAndEntities as jest.Mock).mockResolvedValue({
          entities: [],
          raw: [],
        });

        const result = await service.searchCreators(searchDto);

        expect(result.data).toHaveLength(0);
        expect(result.nextCursor).toBeNull();
        expect(result.hasMore).toBe(false);
      });
    });

    describe('only is_creator = true users returned', () => {
      it('should filter by is_creator = true', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: '', page: 1, limit: 10 };
        const mockUsers: User[] = [
          createMockUser('1', 'creator1', 'Creator 1'),
        ];

        (mockQueryBuilder.getCount as jest.Mock).mockResolvedValue(1);
        (mockQueryBuilder.getRawAndEntities as jest.Mock).mockResolvedValue({
          entities: mockUsers,
          raw: [{ creator_bio: 'Bio' }],
        });

        // Act
        await service.searchCreators(searchDto);

        // Assert
        expect(mockQueryBuilder.where).toHaveBeenCalledWith(
          'user.is_creator = :isCreator',
          { isCreator: true },
        );
      });
    });

    describe('results ordered alphabetically by username', () => {
      it('should order results by username ASC', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: '', page: 1, limit: 10 };
        const mockUsers: User[] = [
          createMockUser('1', 'alice', 'Alice'),
          createMockUser('2', 'bob', 'Bob'),
          createMockUser('3', 'charlie', 'Charlie'),
        ];

        (mockQueryBuilder.getCount as jest.Mock).mockResolvedValue(3);
        (mockQueryBuilder.getRawAndEntities as jest.Mock).mockResolvedValue({
          entities: mockUsers,
          raw: [
            { creator_bio: 'Bio 1' },
            { creator_bio: 'Bio 2' },
            { creator_bio: 'Bio 3' },
          ],
        });

        // Act
        await service.searchCreators(searchDto);

        // Assert
        expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
          'user.username',
          'ASC',
        );
      });
    });

    describe('whitespace-only query treated as empty', () => {
      it('should treat whitespace-only query as empty', async () => {
        // Arrange
        const searchDto: SearchCreatorsDto = { q: '   ', page: 1, limit: 10 };
        const mockUsers: User[] = [createMockUser('1', 'alice', 'Alice')];

        (mockQueryBuilder.getCount as jest.Mock).mockResolvedValue(1);
        (mockQueryBuilder.getRawAndEntities as jest.Mock).mockResolvedValue({
          entities: mockUsers,
          raw: [{ creator_bio: 'Bio' }],
        });

        // Act
        await service.searchCreators(searchDto);

        // Assert
        expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
      });
    });

    describe('stale cursor returns empty data', () => {
      it('should return empty data when cursor is beyond available results', async () => {
        const searchDto: SearchCreatorsDto = { q: '', cursor: 'zzzzz', limit: 10 };

        (mockQueryBuilder.getRawAndEntities as jest.Mock).mockResolvedValue({
          entities: [],
          raw: [],
        });

        const result = await service.searchCreators(searchDto);

        expect(result.data).toHaveLength(0);
        expect(result.nextCursor).toBeNull();
        expect(result.hasMore).toBe(false);
      });
    });
  });

  describe('happy path - createPlan', () => {
    it('should create a plan with valid inputs and return plan with id, creator, asset, amount, intervalDays', () => {
      // Act
      const plan = service.createPlan('creator1', 'USDC', '100.50', 30);

      // Assert
      expect(plan).toBeDefined();
      expect(plan.id).toBeGreaterThan(0);
      expect(plan.creator).toBe('creator1');
      expect(plan.asset).toBe('USDC');
      expect(plan.amount).toBe('100.50');
      expect(plan.intervalDays).toBe(30);
    });

    it('should publish PlanCreatedEvent when EventBus is wired', () => {
      const publish = jest.fn();
      const module = Test.createTestingModule({
        providers: [
          CreatorsService,
          { provide: EventBus, useValue: { publish } },
          {
            provide: getRepositoryToken(User),
            useValue: {
              createQueryBuilder: jest.fn(() => mockQueryBuilder),
            },
          },
        ],
      });

      return module.compile().then((m) => {
        const svc = m.get<CreatorsService>(CreatorsService);
        svc.createPlan('creator1', 'XLM', '50', 7);

        expect(publish).toHaveBeenCalledTimes(1);
        expect(publish.mock.calls[0][0].constructor.name).toBe('PlanCreatedEvent');
      });
    });
  });

  describe('happy path - getPlan', () => {
    it('should retrieve a created plan by id', () => {
      // Arrange
      const plan1 = service.createPlan('creator1', 'USDC', '100', 30);

      // Act
      const retrieved = service.getPlan(plan1.id);

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(plan1.id);
      expect(retrieved?.creator).toBe('creator1');
    });

    it('should return undefined for non-existent plan id', () => {
      // Act
      const retrieved = service.getPlan(99999);

      // Assert
      expect(retrieved).toBeUndefined();
    });
  });

  describe('happy path - getCreatorPlans', () => {
    it('should return all plans for a creator', () => {
      // Arrange
      service.createPlan('alice', 'USDC', '100', 30);
      service.createPlan('alice', 'XLM', '50', 7);
      service.createPlan('bob', 'USDC', '75', 14);

      // Act
      const alicePlans = service.getCreatorPlans('alice');

      // Assert
      expect(alicePlans).toHaveLength(2);
      expect(alicePlans.every((p) => p.creator === 'alice')).toBe(true);
    });

    it('should return empty array for creator with no plans', () => {
      // Act
      const plans = service.getCreatorPlans('nonexistent');

      // Assert
      expect(plans).toHaveLength(0);
    });
  });

  describe('happy path - findAllPlans', () => {
    it('should return all plans paginated with default limit', () => {
      // Arrange
      service.createPlan('alice', 'USDC', '100', 30);
      service.createPlan('bob', 'XLM', '50', 7);

      // Act
      const result = service.findAllPlans({ limit: 20 });

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.limit).toBe(20);
      expect(result.hasMore).toBe(false);
      // nextCursor is the last plan's ID when there are results
      expect(result.nextCursor).toBe('2');
    });

    it('should paginate correctly with cursor and limit', () => {
      // Arrange
      service.createPlan('a', 'USDC', '1', 1);
      service.createPlan('b', 'USDC', '2', 2);
      service.createPlan('c', 'USDC', '3', 3);

      // Act - first page
      const page1 = service.findAllPlans({ limit: 1 });

      // Assert first page
      expect(page1.data).toHaveLength(1);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBe('1');

      // Act - second page
      const page2 = service.findAllPlans({
        cursor: page1.nextCursor ?? undefined,
        limit: 1,
      });

      // Assert second page
      expect(page2.data).toHaveLength(1);
      expect(page2.data[0].id).toBeGreaterThan(page1.data[0].id);
    });

    it('should return data with correct shape', () => {
      // Arrange
      service.createPlan('creator1', 'USDC', '100.50', 30);

      // Act
      const result = service.findAllPlans({ limit: 20 });

      // Assert
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('creator');
      expect(result.data[0]).toHaveProperty('asset');
      expect(result.data[0]).toHaveProperty('amount');
      expect(result.data[0]).toHaveProperty('intervalDays');
    });
  });

  describe('happy path - findCreatorPlans', () => {
    it('should return paginated plans for a specific creator', () => {
      // Arrange
      service.createPlan('alice', 'USDC', '100', 30);
      service.createPlan('alice', 'XLM', '50', 7);
      service.createPlan('bob', 'USDC', '75', 14);

      // Act
      const result = service.findCreatorPlans('alice', { limit: 20 });

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.data.every((p) => p.creator === 'alice')).toBe(true);
      expect(result.hasMore).toBe(false);
    });

    it('should handle pagination with cursor for creator plans', () => {
      // Arrange
      service.createPlan('alice', 'USDC', '1', 1);
      service.createPlan('alice', 'XLM', '2', 2);
      service.createPlan('alice', 'ETH', '3', 3);

      // Act
      const page1 = service.findCreatorPlans('alice', { limit: 1 });
      const page2 = service.findCreatorPlans('alice', {
        cursor: page1.nextCursor ?? undefined,
        limit: 1,
      });

      // Assert
      expect(page1.data).toHaveLength(1);
      expect(page2.data).toHaveLength(1);
      expect(page1.data[0].id).not.toBe(page2.data[0].id);
    });

    it('should return empty pagination for creator with no plans', () => {
      // Act
      const result = service.findCreatorPlans('nonexistent', { limit: 20 });

      // Assert
      expect(result.data).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe('happy path - listCreators', () => {
    it('should list all plans without chain merge', async () => {
      // Arrange
      service.createPlan('alice', 'USDC', '100', 30);
      service.createPlan('bob', 'XLM', '50', 7);

      // Act
      const result = await service.listCreators(false);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('creator');
      expect(result[0]).toHaveProperty('asset');
    });

    it('should return sorted plans by id', async () => {
      // Arrange
      const plan1 = service.createPlan('alice', 'USDC', '100', 30);
      const plan2 = service.createPlan('bob', 'XLM', '50', 7);

      // Act
      const result = await service.listCreators(false);

      // Assert
      expect(result[0].id).toBe(plan1.id);
      expect(result[1].id).toBe(plan2.id);
    });

    it('should mark syncStatus as unknown when chain reader is not configured', async () => {
      // Arrange
      service.createPlan('alice', 'USDC', '100', 30);

      // Act
      const result = await service.listCreators(true);

      // Assert
      expect(result[0]).toHaveProperty('syncStatus');
      expect(result[0].syncStatus).toBe('unknown');
    });
  });

  describe('happy path - searchCreators', () => {
    it('should search creators and return paginated results', async () => {
      // Arrange
      const mockUsers: User[] = [
        createMockUser('1', 'alice', 'Alice Smith'),
        createMockUser('2', 'bob', 'Bob Jones'),
      ];

      (mockQueryBuilder.getRawAndEntities as jest.Mock).mockResolvedValue({
        entities: mockUsers,
        raw: [{ creator_bio: 'Alice bio' }, { creator_bio: 'Bob bio' }],
      });

      // Act
      const result = await service.searchCreators({
        q: 'alice',
        limit: 20,
      });

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.limit).toBe(20);
      expect(result.hasMore).toBe(false);
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('username');
      expect(result.data[0]).toHaveProperty('display_name');
      expect(result.data[0]).toHaveProperty('avatar_url');
      expect(result.data[0]).toHaveProperty('bio');
    });

    it('should return correct pagination metadata', async () => {
      // Arrange
      const mockUsers: User[] = Array.from({ length: 6 }, (_, i) =>
        createMockUser(`${i}`, `user${i}`, `User ${i}`),
      );

      (mockQueryBuilder.getRawAndEntities as jest.Mock).mockResolvedValue({
        entities: mockUsers,
        raw: mockUsers.map(() => ({ creator_bio: 'Bio' })),
      });

      // Act
      const result = await service.searchCreators({ limit: 5 });

      // Assert
      expect(result.data).toHaveLength(5);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('user4');
    });
  });

  describe('logging and resilience', () => {
    it('createPlan logs debug when EventBus is not wired', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CreatorsService,
          {
            provide: getRepositoryToken(User),
            useValue: {
              createQueryBuilder: jest.fn(() => mockQueryBuilder),
            },
          },
        ],
      }).compile();

      const isolated = module.get<CreatorsService>(CreatorsService);
      const plan = isolated.createPlan('addr1', 'USDC:1', '5', 7);

      expect(plan.creator).toBe('addr1');
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringMatching(
          /Plan \d+ created for addr1; EventBus not wired, skipping PlanCreatedEvent/,
        ),
      );
    });

    it('createPlan survives publish throwing and logs a warning', () => {
      const publish = jest.fn().mockImplementation(() => {
        throw new Error('bus down');
      });
      const busModule = Test.createTestingModule({
        providers: [
          CreatorsService,
          { provide: EventBus, useValue: { publish } },
          {
            provide: getRepositoryToken(User),
            useValue: {
              createQueryBuilder: jest.fn(() => mockQueryBuilder),
            },
          },
        ],
      });

      return busModule.compile().then((m) => {
        const svc = m.get<CreatorsService>(CreatorsService);
        const plan = svc.createPlan('c1', 'XLM', '1', 1);
        expect(plan.id).toBeGreaterThan(0);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringMatching(
            /Plan \d+ created but PlanCreatedEvent publish failed: bus down/,
          ),
        );
      });
    });

    it('findAllPlans ignores invalid cursor and logs debug', () => {
      service.createPlan('a', 'USDC', '1', 30);
      service.findAllPlans({ cursor: 'not-a-number', limit: 10 } as PaginationDto);
      expect(debugSpy).toHaveBeenCalledWith(
        'Ignoring invalid plans pagination cursor "not-a-number"',
      );
    });

    it('searchCreators logs error and rethrows when the query fails', async () => {
      (mockQueryBuilder.getRawAndEntities as jest.Mock).mockRejectedValue(
        new Error('connection reset'),
      );

      await expect(
        service.searchCreators({ q: 'x', limit: 10 }),
      ).rejects.toThrow('connection reset');

      expect(errorSpy).toHaveBeenCalledWith(
        'Creator search failed: connection reset',
      );
    });
  });
});

// Helper function to create mock users
function createMockUser(
  id: string,
  username: string,
  display_name: string,
): User {
  return {
    id,
    username,
    display_name,
    avatar_url: `https://example.com/${username}.jpg`,
    email: `${username}@example.com`,
    password_hash: 'hashed',
    email_notifications: true,
    push_notifications: false,
    marketing_emails: false,
    role: UserRole.USER,
    is_creator: true,
    created_at: new Date(),
    updated_at: new Date(),
  };
}
