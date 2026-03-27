import { Module } from '@nestjs/common';
import { SubscriptionLifecycleIndexerController } from './subscription-lifecycle-indexer.controller';
import { SubscriptionLifecycleIndexerService } from './subscription-lifecycle-indexer.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SUBSCRIPTION_EVENT_PUBLISHER } from './events';
import { SubscriptionsService } from './subscriptions.service';
import { EventsModule } from '../events/events.module';
import { LoggingModule } from '../common/logging.module';
import { FanBearerGuard } from './guards/fan-bearer.guard';
import { SubscriptionChainReaderService } from './subscription-chain-reader.service';

@Module({
  imports: [EventsModule, LoggingModule],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    SubscriptionChainReaderService,
    FanBearerGuard,
    {
      provide: SUBSCRIPTION_EVENT_PUBLISHER,
      useValue: { emit: () => undefined },
    },
  ],
  exports: [SubscriptionsService, SubscriptionLifecycleIndexerService],
})
export class SubscriptionsModule {}
