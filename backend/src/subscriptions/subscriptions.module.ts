import { Module } from '@nestjs/common';
import { SubscriptionLifecycleIndexerController } from './subscription-lifecycle-indexer.controller';
import { SubscriptionLifecycleIndexerService } from './subscription-lifecycle-indexer.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SUBSCRIPTION_EVENT_PUBLISHER } from './events';
import { SubscriptionsService } from './subscriptions.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [SubscriptionsController, SubscriptionLifecycleIndexerController],
  providers: [
    SubscriptionsService,
    SubscriptionLifecycleIndexerService,
    {
      provide: SUBSCRIPTION_EVENT_PUBLISHER,
      useValue: {
        emit: () => undefined,
      },
    },
  ],
  exports: [SubscriptionsService, SubscriptionLifecycleIndexerService],
})
export class SubscriptionsModule {}
