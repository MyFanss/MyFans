import { Module } from '@nestjs/common';
import { LoggingModule } from '../common/logging.module';
import { EventsModule } from '../events/events.module';
import { SubscriptionLifecycleIndexerController } from './subscription-lifecycle-indexer.controller';
import { SubscriptionLifecycleIndexerService } from './subscription-lifecycle-indexer.service';
import { SUBSCRIPTION_EVENT_PUBLISHER } from './events';
import { FanBearerGuard } from './guards/fan-bearer.guard';
import { SubscriptionChainReaderService } from './subscription-chain-reader.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [EventsModule, LoggingModule],
  controllers: [SubscriptionsController, SubscriptionLifecycleIndexerController],
  providers: [
    SubscriptionsService,
    SubscriptionChainReaderService,
    SubscriptionCacheService,
    GatedContentGuard,
    FanBearerGuard,
    SubscriptionLifecycleIndexerService,
    {
      provide: SUBSCRIPTION_EVENT_PUBLISHER,
      useValue: { emit: () => undefined },
    },
  ],
  exports: [SubscriptionsService, SubscriptionLifecycleIndexerService],
})
export class SubscriptionsModule {}
