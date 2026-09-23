import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { SubscriptionCreatedHandler } from './handlers/subscription-created.handler';
import { SubscriptionRenewedHandler } from './handlers/subscription-renewed.handler';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [SubscriptionsModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    SubscriptionCreatedHandler,
    SubscriptionRenewedHandler,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
