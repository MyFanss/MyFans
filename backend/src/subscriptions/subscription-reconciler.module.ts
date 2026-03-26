import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SubscriptionReconcilerService } from './subscription-reconciler.service';
import { SubscriptionsModule } from './subscriptions.module';
import { LoggingModule } from '../common/logging.module';
import { SorobanRpcService } from '../common/services/soroban-rpc.service';

@Module({
  imports: [ScheduleModule.forRoot(), SubscriptionsModule, LoggingModule],
  providers: [SubscriptionReconcilerService, SorobanRpcService],
  exports: [SubscriptionReconcilerService],
})
export class SubscriptionReconcilerModule {}
