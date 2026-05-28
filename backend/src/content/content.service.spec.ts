import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ContentService } from './content.service';
import { ContentMetadata, ContentType } from './entities/content.entity';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findAndCount: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
});

const makeContent = (overrides: Partial<ContentMetadata> = {}): ContentMetadata =>
  ({
    id: 'uuid-1',
    creator_id: 'creator-1',
    title: 'Test Content',
    description: null,
    ipfs_cid: 'QmTest',
    ipfs_url: null,
    content_type: ContentType.IMAGE,
    subscription_tier: null,
    is_published: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as ContentMetadata);

describe('ContentService', () => {
  let service: ContentService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentService,
        { provide: getRepositoryToken(ContentMetadata), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(ContentService);
    repo = module.get(getRepositoryToken(ContentMetadata));
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates and saves content with creator_id', async () => {
      const dto = { title: 'My Content', ipfs_cid: 'QmAbc' };
      const entity = makeContent();
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      const result = await service.create('creator-1', dto as any);

      expect(repo.create).toHaveBeenCalledWith({ ...dto, creator_id: 'creator-1' });
      expect(repo.save).toHaveBeenCalledWith(entity);
      expect(result).toBe(entity);
    });
  });

  describe('findAll', () => {
    it('returns paginated results', async () => {
      const items = [makeContent()];
      repo.findAndCount.mockResolvedValue([items, 1]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(items);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });
  });

  describe('findByCreator', () => {
    it('filters by creator_id', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findByCreator('creator-1', { page: 1, limit: 10 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { creator_id: 'creator-1' } }),
      );
    });
  });

  describe('findOne', () => {
    it('returns content when found', async () => {
      const entity = makeContent();
      repo.findOne.mockResolvedValue(entity);

      const result = await service.findOne('uuid-1');
      expect(result).toBe(entity);
    });

    it('throws NotFoundException when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates content when requester is owner', async () => {
      const entity = makeContent();
      repo.findOne.mockResolvedValue(entity);
      repo.save.mockResolvedValue({ ...entity, title: 'Updated' });

      const result = await service.update('uuid-1', 'creator-1', { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });

    it('throws ForbiddenException when requester is not owner', async () => {
      repo.findOne.mockResolvedValue(makeContent({ creator_id: 'creator-1' }));
      await expect(service.update('uuid-1', 'other-user', { title: 'X' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('remove', () => {
    it('removes content when requester is owner', async () => {
      const entity = makeContent();
      repo.findOne.mockResolvedValue(entity);
      repo.remove.mockResolvedValue(undefined);

      await expect(service.remove('uuid-1', 'creator-1')).resolves.toBeUndefined();
      expect(repo.remove).toHaveBeenCalledWith(entity);
    });

    it('throws ForbiddenException when requester is not owner', async () => {
      repo.findOne.mockResolvedValue(makeContent({ creator_id: 'creator-1' }));
      await expect(service.remove('uuid-1', 'intruder')).rejects.toThrow(ForbiddenException);
    });
  });
});
