import { Test, TestingModule } from '@nestjs/testing';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { ContentType } from './entities/content.entity';
import { PaginatedResponseDto } from '../common/dto';

const mockService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByCreator: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

const fakeUser = { userId: 'creator-1', email: 'test@example.com', role: 'user' };

const fakeContent = {
  id: 'uuid-1',
  creator_id: 'creator-1',
  title: 'Test',
  description: null,
  ipfs_cid: 'QmTest',
  ipfs_url: null,
  content_type: ContentType.IMAGE,
  subscription_tier: null,
  is_published: false,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('ContentController', () => {
  let controller: ContentController;
  let service: ReturnType<typeof mockService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContentController],
      providers: [{ provide: ContentService, useFactory: mockService }],
    }).compile();

    controller = module.get(ContentController);
    service = module.get(ContentService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  describe('create', () => {
    it('delegates to service with userId from JWT', async () => {
      service.create.mockResolvedValue(fakeContent);
      const dto = { title: 'Test', ipfs_cid: 'QmTest' };

      const result = await controller.create(fakeUser, dto as any);

      expect(service.create).toHaveBeenCalledWith('creator-1', dto);
      expect(result).toBe(fakeContent);
    });
  });

  describe('findAll', () => {
    it('returns paginated content', async () => {
      const paginated = new PaginatedResponseDto([fakeContent], 1, 1, 20);
      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({ page: 1, limit: 20 });
      expect(result).toBe(paginated);
    });
  });

  describe('findByCreator', () => {
    it('delegates with creatorId param', async () => {
      const paginated = new PaginatedResponseDto([fakeContent], 1, 1, 20);
      service.findByCreator.mockResolvedValue(paginated);

      const result = await controller.findByCreator('creator-1', { page: 1, limit: 20 });
      expect(service.findByCreator).toHaveBeenCalledWith('creator-1', { page: 1, limit: 20 });
      expect(result).toBe(paginated);
    });
  });

  describe('findOne', () => {
    it('returns single content item', async () => {
      service.findOne.mockResolvedValue(fakeContent);
      const result = await controller.findOne('uuid-1');
      expect(result).toBe(fakeContent);
    });
  });

  describe('update', () => {
    it('passes userId for ownership check', async () => {
      service.update.mockResolvedValue({ ...fakeContent, title: 'Updated' });
      const result = await controller.update('uuid-1', fakeUser, { title: 'Updated' });
      expect(service.update).toHaveBeenCalledWith('uuid-1', 'creator-1', { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('passes userId for ownership check', async () => {
      service.remove.mockResolvedValue(undefined);
      await controller.remove('uuid-1', fakeUser);
      expect(service.remove).toHaveBeenCalledWith('uuid-1', 'creator-1');
    });
  });
});
