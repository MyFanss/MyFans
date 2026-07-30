import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favoritesRepository: Repository<Favorite>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Add a creator to the user's favorites (idempotent).
   * Returns 201 if created, 200 if already favorited.
   */
  async addFavorite(
    userId: string,
    creatorId: string,
  ): Promise<{ status: number; favorite: Favorite }> {
    const creator = await this.userRepository.findOne({
      where: { id: creatorId },
    });
    if (!creator) {
      throw new NotFoundException(`Creator with id "${creatorId}" not found`);
    }

    const existing = await this.favoritesRepository.findOne({
      where: { userId, creatorId },
    });
    if (existing) {
      return { status: 200, favorite: existing };
    }

    const favorite = this.favoritesRepository.create({ userId, creatorId });
    const saved = await this.favoritesRepository.save(favorite);
    return { status: 201, favorite: saved };
  }

  /** Remove a creator from the user's favorites. */
  async removeFavorite(userId: string, creatorId: string): Promise<void> {
    const favorite = await this.favoritesRepository.findOne({
      where: { userId, creatorId },
    });
    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }
    await this.favoritesRepository.remove(favorite);
  }

  /** Lists the authenticated user's own favorited creator IDs. Never another user's. */
  async listFavoriteCreatorIds(userId: string): Promise<string[]> {
    const favorites = await this.favoritesRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return favorites.map((f) => f.creatorId);
  }

  async isFavorite(userId: string, creatorId: string): Promise<boolean> {
    const favorite = await this.favoritesRepository.findOne({
      where: { userId, creatorId },
    });
    return !!favorite;
  }
}
