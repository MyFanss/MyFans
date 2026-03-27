import { Module } from '@nestjs/common';
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
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
