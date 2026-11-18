import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './entities/subscription.entity';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionsRepository: Repository<Subscription>,
  ) {}

  async checkSubscription(userId: string, creatorId: string): Promise<boolean> {
    if (!userId || !creatorId) {
      return false;
    }

    const subscription = await this.subscriptionsRepository.findOne({
      where: {
        userId,
        creatorId,
        status: 'active',
      },
    });

    return !!subscription;
  }

  async assertSubscription(userId: string, creatorId: string): Promise<void> {
    const isSubscribed = await this.checkSubscription(userId, creatorId);
    if (!isSubscribed) {
      throw new NotFoundException('Active subscription required');
    }
  }
}
