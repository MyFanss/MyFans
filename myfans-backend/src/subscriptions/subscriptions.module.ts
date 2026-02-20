import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './entities/subscription.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription])],
  exports: [TypeOrmModule],
})
export class SubscriptionsModule {}
