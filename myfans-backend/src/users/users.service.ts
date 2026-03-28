import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { Creator } from '../creators/entities/creator.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Creator)
    private readonly creatorRepository: Repository<Creator>,
  ) {}

  async findOneById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = this.userRepository.create(userData);
    return this.userRepository.save(user);
  }

  async getMe(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['creator'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toMeResponse(user);
  }

  async updateProfile(userId: string, dto: UpdateUserProfileDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.username !== undefined) {
      const taken = await this.userRepository.findOne({
        where: { username: dto.username },
      });
      if (taken && taken.id !== userId) {
        throw new ConflictException('Username already taken');
      }
    }

    const patch: Partial<User> = {};
    if (dto.display_name !== undefined) patch.display_name = dto.display_name;
    if (dto.username !== undefined) patch.username = dto.username;
    if (dto.avatar_url !== undefined) patch.avatar_url = dto.avatar_url;
    if (dto.website_url !== undefined) patch.website_url = dto.website_url;
    if (dto.other_url !== undefined) patch.other_url = dto.other_url;
    if (dto.x_handle !== undefined) {
      patch.x_handle = this.normalizeHandle(dto.x_handle);
    }
    if (dto.instagram_handle !== undefined) {
      patch.instagram_handle = this.normalizeHandle(dto.instagram_handle);
    }

    await this.userRepository.update(userId, patch);
    return this.getMe(userId);
  }

  private normalizeHandle(raw?: string): string | null {
    if (raw === undefined) return null;
    const t = raw.trim();
    if (!t) return null;
    return t.startsWith('@') ? t.slice(1) : t;
  }

  private toMeResponse(user: User) {
    return {
      id: user.id,
      email: user.email,
      is_creator: user.is_creator,
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      website_url: user.website_url,
      x_handle: user.x_handle,
      instagram_handle: user.instagram_handle,
      other_url: user.other_url,
      creator: user.creator ? this.toCreatorSummary(user.creator) : null,
    };
  }

  private toCreatorSummary(creator: Creator) {
    return {
      id: creator.id,
      bio: creator.bio,
      subscription_price: creator.subscription_price,
      currency: creator.currency,
      banner_url: creator.banner_url,
      is_verified: creator.is_verified,
      followers_count: creator.followers_count,
    };
  }
}
