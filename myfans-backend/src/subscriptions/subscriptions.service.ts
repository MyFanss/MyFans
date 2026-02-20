import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Creator } from '../creators/entities/creator.entity';
import { User } from '../users/entities/user.entity';
import { SubscribeDto } from './dto/subscribe.dto';
import {
  Subscription,
  SubscriptionStatus,
} from './entities/subscription.entity';

const SUBSCRIPTION_DAYS = 30;

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Creator)
    private readonly creatorRepo: Repository<Creator>,
  ) {}

  async subscribe(fan: User, dto: SubscribeDto) {
    const creator = await this.creatorRepo.findOne({
      where: { id: dto.creator_id },
      relations: ['user'],
    });

    if (!creator) {
      throw new NotFoundException(`Creator ${dto.creator_id} not found`);
    }

    if (fan.id === creator.user_id) {
      throw new ConflictException('Cannot subscribe to yourself');
    }

    const existing = await this.subscriptionRepo.findOne({
      where: {
        fan: { id: fan.id },
        creator: { id: creator.id },
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (existing) {
      throw new ConflictException(
        'Active subscription already exists for this creator',
      );
    }

    const startedAt = new Date();
    const expiresAt = new Date(startedAt);
    expiresAt.setDate(expiresAt.getDate() + SUBSCRIPTION_DAYS);

    const subscription = this.subscriptionRepo.create({
      fan,
      creator,
      status: SubscriptionStatus.ACTIVE,
      started_at: startedAt,
      expires_at: expiresAt,
      plan_id: dto.plan_id ?? null,
    });

    return this.subscriptionRepo.save(subscription);
  }

  async cancel(subscriptionId: string, userId: string) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { id: subscriptionId },
      relations: ['fan', 'creator'],
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription ${subscriptionId} not found`);
    }

    if (subscription.fan.id !== userId) {
      throw new ForbiddenException('Only the fan can cancel this subscription');
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new ConflictException(
        `Subscription is already ${subscription.status}`,
      );
    }

    subscription.status = SubscriptionStatus.CANCELLED;
    return this.subscriptionRepo.save(subscription);
  }
}
