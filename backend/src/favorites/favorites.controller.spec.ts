import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

describe('FavoritesController', () => {
  let controller: FavoritesController;
  let service: {
    addFavorite: jest.Mock;
    removeFavorite: jest.Mock;
    listFavoriteCreatorIds: jest.Mock;
  };
  const mockUser = { userId: 'jwt-user-1' };

  beforeEach(async () => {
    service = {
      addFavorite: jest.fn(),
      removeFavorite: jest.fn(),
      listFavoriteCreatorIds: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FavoritesController],
      providers: [{ provide: FavoritesService, useValue: service }],
    }).compile();

    controller = module.get(FavoritesController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it("returns only the authenticated user's favorite creator IDs", async () => {
      service.listFavoriteCreatorIds.mockResolvedValue(['creator-1', 'creator-2']);

      const result = await controller.findAll(mockUser);

      expect(service.listFavoriteCreatorIds).toHaveBeenCalledWith('jwt-user-1');
      expect(result).toEqual(['creator-1', 'creator-2']);
    });
  });

  describe('addFavorite', () => {
    it('calls service.addFavorite with userId and creatorId', async () => {
      service.addFavorite.mockResolvedValue({ status: 201, favorite: {} });

      const result = await controller.addFavorite('creator-1', mockUser);

      expect(service.addFavorite).toHaveBeenCalledWith('jwt-user-1', 'creator-1');
      expect(result).toEqual({ creatorId: 'creator-1', favorited: true });
    });

    it('propagates NotFoundException when the target creator is missing', async () => {
      service.addFavorite.mockRejectedValue(
        new NotFoundException('Creator with id "missing" not found'),
      );

      await expect(
        controller.addFavorite('missing', mockUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('removeFavorite', () => {
    it('calls service.removeFavorite with userId and creatorId', async () => {
      service.removeFavorite.mockResolvedValue(undefined);

      const result = await controller.removeFavorite('creator-1', mockUser);

      expect(service.removeFavorite).toHaveBeenCalledWith(
        'jwt-user-1',
        'creator-1',
      );
      expect(result).toBeUndefined();
    });

    it('propagates NotFoundException when the favorite does not exist', async () => {
      service.removeFavorite.mockRejectedValue(
        new NotFoundException('Favorite not found'),
      );

      await expect(
        controller.removeFavorite('creator-1', mockUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
