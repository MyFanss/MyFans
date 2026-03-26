import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SUBSCRIPTION_EVENT_PUBLISHER } from './events';
import { SubscriptionsService } from './subscriptions.service';
import { LoggingModule } from '../common/logging.module';

@Module({
  imports: [LoggingModule],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    {
      provide: SUBSCRIPTION_EVENT_PUBLISHER,
      useValue: {
        emit: () => undefined,
      },
    },
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
