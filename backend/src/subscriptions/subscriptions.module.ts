import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SUBSCRIPTION_EVENT_PUBLISHER } from './events';
import { SubscriptionsService } from './subscriptions.service';
import { EventsModule } from '../events/events.module';
import { LoggingModule } from '../common/logging.module';

@Module({
  imports: [EventsModule, LoggingModule],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    {
      provide: SUBSCRIPTION_EVENT_PUBLISHER,
      useValue: { emit: () => undefined },
    },
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
