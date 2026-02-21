import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateUserDto, UserProfileDto } from './dto';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { Creator } from './entities/creator.entity';
import { CreatorProfileDto } from './dto/creator-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
     @InjectRepository(User)
    private creatorRepository: Repository<Creator>
  ) {}

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

   async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateNotificationPreferences(
    userId: string,
    dto: UpdateNotificationsDto,
  ) {
    const user = await this.findById(userId);

    
    Object.assign(user, dto);

    await this.usersRepository.save(user);

    return {
      message: 'Notification preferences updated successfully',
      preferences: {
        email_notifications: user.email_notifications,
        push_notifications: user.push_notifications,
        marketing_emails: user.marketing_emails,
      },
    };
  }

  async getCurrentUserProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) throw new NotFoundException('User not found');

    const profile: UserProfileDto = {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar_url:user.avatar_url,
      is_creator: user.is_creator,
      email_notifications: user.email_notifications,
      push_notifications: user.push_notifications,
      marketing_emails: user.marketing_emails,
      created_at: user.created_at, 
    };

    if (user.is_creator) {
      const creator = await this.creatorRepository.findOne({
        where: { user: { id: userId } },
      });

      if (creator) {
        profile.creator = {
          bio: creator.bio,
          subscription_price: creator.subscription_price,
          total_subscribers: creator.total_subscribers,
          is_active: creator.is_active,
        } as CreatorProfileDto;
      }
    }

    return profile;
  }
}
