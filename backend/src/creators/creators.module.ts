import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';
import { CreatorDashboardService } from './creator-dashboard.service';
import { User } from '../users/entities/user.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), SubscriptionsModule],
  controllers: [CreatorsController],
  providers: [CreatorsService, CreatorDashboardService],
  exports: [CreatorsService, CreatorDashboardService],
})
export class CreatorsModule {}
