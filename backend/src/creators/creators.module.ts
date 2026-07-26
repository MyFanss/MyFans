import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';
import { CreatorDashboardService } from './creator-dashboard.service';
import { CreatorRegistrySyncService } from './creator-registry-sync.service';
import { User } from '../users/entities/user.entity';
import { CreatorOnchainMapping } from './entities/creator-onchain-mapping.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, CreatorOnchainMapping]),
    ScheduleModule,
    SubscriptionsModule,
  ],
  controllers: [CreatorsController],
  providers: [CreatorsService, CreatorDashboardService, CreatorRegistrySyncService],
  exports: [CreatorsService, CreatorDashboardService, CreatorRegistrySyncService],
})
export class CreatorsModule {}
