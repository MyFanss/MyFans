import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { Creator } from './entities/creator.entity';

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
        // channels
        email_notifications: user.email_notifications,
        push_notifications: user.push_notifications,
        marketing_emails: user.marketing_emails,
        // per-event email
        email_new_subscriber: user.email_new_subscriber,
        email_subscription_renewal: user.email_subscription_renewal,
        email_new_comment: user.email_new_comment,
        email_new_like: user.email_new_like,
        email_new_message: user.email_new_message,
        email_payout: user.email_payout,
        // per-event push
        push_new_subscriber: user.push_new_subscriber,
        push_subscription_renewal: user.push_subscription_renewal,
        push_new_comment: user.push_new_comment,
        push_new_like: user.push_new_like,
        push_new_message: user.push_new_message,
        push_payout: user.push_payout,
      },
    };
  }
}
