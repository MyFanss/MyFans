import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggingModule } from '../common/logging.module';
import { EventsModule } from '../events/events.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { SubscriptionLifecycleIndexerController } from './subscription-lifecycle-indexer.controller';
import { SubscriptionLifecycleIndexerService } from './subscription-lifecycle-indexer.service';
import { SubscriptionIndexEntity } from './entities/subscription-index.entity';
import { FanSpendingCapEntity } from './entities/fan-spending-cap.entity';
import { SubscriptionIndexRepository } from './repositories/subscription-index.repository';
import { SubscriptionEventPollerService } from './services/subscription-event-poller.service';
import { SubscriptionReconcilerService } from './subscription-reconciler.service';
import { SubscriptionChainSyncService } from './services/subscription-chain-sync.service';
import { SpendingCapService } from './services/spending-cap.service';
import { SUBSCRIPTION_EVENT_PUBLISHER } from './events';
import { FanBearerGuard } from './guards/fan-bearer.guard';
import { HybridFanAuthGuard } from './guards/hybrid-fan-auth.guard';
import { OptionalHybridFanAuthGuard } from './guards/optional-hybrid-fan-auth.guard';
import { GatedContentGuard } from './gated-content.guard';
import { FeatureFlagGuard } from '../feature-flags/feature-flag.guard';
import { SubscriptionCacheService } from './subscription-cache.service';
import { SubscriptionChainReaderService } from './subscription-chain-reader.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SpendingCapController } from './spending-cap.controller';
import { SubscriptionsService } from './subscriptions.service';
import { RPC_BALANCE_ADAPTER, MockRpcAdapter, HorizonRpcAdapter } from './rpc-adapter';
import { LedgerClockService } from './ledger-clock.service';
import { LoggingSubscriptionEventPublisher } from './subscription-event-publisher.service';
import { StellarService } from '../common/stellar.service';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule,
    TypeOrmModule.forFeature([SubscriptionIndexEntity, FanSpendingCapEntity]),
    EventsModule,
    LoggingModule,
    FeatureFlagsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SubscriptionsController, SpendingCapController, SubscriptionLifecycleIndexerController],
  providers: [
    SubscriptionIndexRepository,
    SubscriptionEventPollerService,
    SubscriptionReconcilerService,
    SubscriptionChainSyncService,
    SpendingCapService,
    SubscriptionsService,
    SubscriptionChainReaderService,
    LedgerClockService,
    SubscriptionCacheService,
    GatedContentGuard,
    FanBearerGuard,
    HybridFanAuthGuard,
    OptionalHybridFanAuthGuard,
    FeatureFlagGuard,
    SubscriptionLifecycleIndexerService,
    StellarService,
    MockRpcAdapter,
    HorizonRpcAdapter,
    {
      provide: RPC_BALANCE_ADAPTER,
      useFactory: (mock: MockRpcAdapter, real: HorizonRpcAdapter) =>
        process.env.SUBSCRIPTIONS_USE_MOCK_RPC === 'true' ||
        process.env.NODE_ENV === 'test'
          ? mock
          : real,
      inject: [MockRpcAdapter, HorizonRpcAdapter],
    },
    {
      provide: SUBSCRIPTION_EVENT_PUBLISHER,
      useClass: LoggingSubscriptionEventPublisher,
    },
  ],
  exports: [
    SubscriptionsService,
    SubscriptionLifecycleIndexerService,
    SubscriptionIndexRepository,
    SubscriptionChainSyncService,
    HybridFanAuthGuard,
    OptionalHybridFanAuthGuard,
  ],
})
export class SubscriptionsModule {}
