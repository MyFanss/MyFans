import { Injectable } from '@nestjs/common';
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
    const subscription = await this.subscriptionsRepository.findOne({
      where: { userId, creatorId },
    });
    return !!subscription;
  }
}
