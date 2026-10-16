import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Like } from './like.entity';
import { LikesService } from './likes.service';

describe('LikesService', () => {
  let service: LikesService;
  let mockRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };

  beforeEach(async () => {
    mockRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LikesService,
        { provide: getRepositoryToken(Like), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<LikesService>(LikesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('like', () => {
    it('does not save when the like row already exists and returns liked: true', async () => {
      const existing = { id: 'like-1', userId: 'user-1', targetId: 'post-1' };
      mockRepo.findOne.mockResolvedValue(existing);

      const result = await service.like('user-1', 'post-1');

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-1', targetId: 'post-1' },
      });
      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(mockRepo.create).not.toHaveBeenCalled();
      expect(result).toEqual({ liked: true });
    });

    it('creates and saves a new like row when none exists', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const created = { userId: 'user-1', targetId: 'post-1' };
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue({ id: 'like-1', ...created });

      const result = await service.like('user-1', 'post-1');

      expect(mockRepo.create).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledWith(created);
      expect(result).toEqual({ liked: true });
    });
  });

  describe('unlike', () => {
    it('deletes by userId/targetId and returns liked: false even when nothing was deleted', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 0 });

      const result = await service.unlike('user-1', 'post-1');

      expect(mockRepo.delete).toHaveBeenCalledWith({
        userId: 'user-1',
        targetId: 'post-1',
      });
      expect(result).toEqual({ liked: false });
    });
  });

  describe('count', () => {
    it('delegates to the repository with the documented where clause', async () => {
      mockRepo.count.mockResolvedValue(3);

      const result = await service.count('post-1');

      expect(mockRepo.count).toHaveBeenCalledWith({ where: { targetId: 'post-1' } });
      expect(result).toBe(3);
    });
  });

  describe('hasLiked', () => {
    it('returns true when a like row exists', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'like-1' });

      const result = await service.hasLiked('user-1', 'post-1');

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-1', targetId: 'post-1' },
      });
      expect(result).toBe(true);
    });

    it('returns false when no like row exists', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.hasLiked('user-1', 'post-1');

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-1', targetId: 'post-1' },
      });
      expect(result).toBe(false);
    });
  });
});
