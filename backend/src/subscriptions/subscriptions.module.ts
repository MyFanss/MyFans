import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { LoggingModule } from '../common/logging.module';
import { EventsModule } from '../events/events.module';
import { SubscriptionLifecycleIndexerController } from './subscription-lifecycle-indexer.controller';
import { SubscriptionLifecycleIndexerService } from './subscription-lifecycle-indexer.service';
import { SubscriptionIndexEntity } from './entities/subscription-index.entity';
import { SubscriptionIndexRepository } from './repositories/subscription-index.repository';
import { SubscriptionEventPollerService } from './services/subscription-event-poller.service';
import { SUBSCRIPTION_EVENT_PUBLISHER } from './events';
import { FanBearerGuard } from './guards/fan-bearer.guard';
import { GatedContentGuard } from './gated-content.guard';
import { SubscriptionCacheService } from './subscription-cache.service';
import { SubscriptionChainReaderService } from './subscription-chain-reader.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { RPC_BALANCE_ADAPTER, MockRpcAdapter } from './rpc-adapter';
import { LedgerClockService } from './ledger-clock.service';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule,
    TypeOrmModule.forFeature([SubscriptionIndexEntity]),
    EventsModule, 
    LoggingModule,
  ],
  controllers: [SubscriptionsController, SubscriptionLifecycleIndexerController],
  providers: [
    SubscriptionIndexRepository,
    SubscriptionEventPollerService,
    SubscriptionsService,
    SubscriptionChainReaderService,
    LedgerClockService,
    SubscriptionCacheService,
    GatedContentGuard,
    FanBearerGuard,
    SubscriptionLifecycleIndexerService,
    {
      provide: SUBSCRIPTION_EVENT_PUBLISHER,
      useValue: { emit: () => undefined },
    },
  ],
  exports: [SubscriptionsService, SubscriptionLifecycleIndexerService, SubscriptionIndexRepository],
})
export class SubscriptionsModule {}
