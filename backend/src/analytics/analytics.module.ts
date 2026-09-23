import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { MrrService } from './mrr.service';
import { SubscriptionCreatedHandler } from './handlers/subscription-created.handler';
import { SubscriptionRenewedHandler } from './handlers/subscription-renewed.handler';
import { SubscriptionCanceledHandler } from './handlers/subscription-canceled.handler';
import { UploadCreatedHandler } from './handlers/upload-created.handler';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [SubscriptionsModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    MrrService,
    SubscriptionCreatedHandler,
    SubscriptionRenewedHandler,
    SubscriptionCanceledHandler,
    UploadCreatedHandler,
  ],
  exports: [AnalyticsService, MrrService],
})
export class AnalyticsModule {}
