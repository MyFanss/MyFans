import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { Favorite } from './entities/favorite.entity';
import { User } from '../users/entities/user.entity';

const makeFavorite = (overrides: Partial<Favorite> = {}): Favorite =>
  ({
    id: 'favorite-1',
    userId: 'user-1',
    creatorId: 'creator-1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }) as Favorite;

describe('FavoritesService', () => {
  let service: FavoritesService;
  let favoritesRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    remove: jest.Mock;
  };
  let userRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    favoritesRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
    };
    userRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: getRepositoryToken(Favorite), useValue: favoritesRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get(FavoritesService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── addFavorite ─────────────────────────────────────────────────────────────

  describe('addFavorite', () => {
    it('throws NotFoundException when the target creator does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addFavorite('user-1', 'missing-creator'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(favoritesRepo.save).not.toHaveBeenCalled();
    });

    it('creates and returns a 201 when not already favorited', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'creator-1' });
      favoritesRepo.findOne.mockResolvedValue(null);
      const favorite = makeFavorite();
      favoritesRepo.create.mockReturnValue(favorite);
      favoritesRepo.save.mockResolvedValue(favorite);

      const result = await service.addFavorite('user-1', 'creator-1');

      expect(favoritesRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        creatorId: 'creator-1',
      });
      expect(result.status).toBe(201);
      expect(result.favorite).toBe(favorite);
    });

    it('is idempotent: returns 200 and does not duplicate when already favorited', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'creator-1' });
      const existing = makeFavorite();
      favoritesRepo.findOne.mockResolvedValue(existing);

      const result = await service.addFavorite('user-1', 'creator-1');

      expect(favoritesRepo.save).not.toHaveBeenCalled();
      expect(result.status).toBe(200);
      expect(result.favorite).toBe(existing);
    });
  });

  // ── removeFavorite ──────────────────────────────────────────────────────────

  describe('removeFavorite', () => {
    it('removes the favorite when it exists', async () => {
      const favorite = makeFavorite();
      favoritesRepo.findOne.mockResolvedValue(favorite);

      await service.removeFavorite('user-1', 'creator-1');

      expect(favoritesRepo.remove).toHaveBeenCalledWith(favorite);
    });

    it('throws NotFoundException when the favorite does not exist', async () => {
      favoritesRepo.findOne.mockResolvedValue(null);

      await expect(
        service.removeFavorite('user-1', 'creator-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(favoritesRepo.remove).not.toHaveBeenCalled();
    });
  });

  // ── listFavoriteCreatorIds ──────────────────────────────────────────────────

  describe('listFavoriteCreatorIds', () => {
    it('scopes results to the given userId only', async () => {
      favoritesRepo.find.mockResolvedValue([
        makeFavorite({ creatorId: 'creator-1' }),
        makeFavorite({ creatorId: 'creator-2' }),
      ]);

      const result = await service.listFavoriteCreatorIds('user-1');

      expect(favoritesRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
      expect(result).toEqual(['creator-1', 'creator-2']);
    });

    it('returns an empty array when the user has no favorites', async () => {
      favoritesRepo.find.mockResolvedValue([]);

      const result = await service.listFavoriteCreatorIds('user-1');

      expect(result).toEqual([]);
    });
  });

  // ── isFavorite ───────────────────────────────────────────────────────────────

  describe('isFavorite', () => {
    it('returns true when a favorite exists', async () => {
      favoritesRepo.findOne.mockResolvedValue(makeFavorite());

      expect(await service.isFavorite('user-1', 'creator-1')).toBe(true);
    });

    it('returns false when no favorite exists', async () => {
      favoritesRepo.findOne.mockResolvedValue(null);

      expect(await service.isFavorite('user-1', 'creator-1')).toBe(false);
    });
  });
});
