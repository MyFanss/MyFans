import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SubscriptionsController } from './subscriptions.controller';
import { SUBSCRIPTION_EVENT_PUBLISHER } from './events';
import { SubscriptionsService } from './subscriptions.service';
import { EventsModule } from '../events/events.module';
import { LoggingModule } from '../common/logging.module';
import { FanBearerGuard } from './guards/fan-bearer.guard';
import { SubscriptionChainReaderService } from './subscription-chain-reader.service';
import { SubscriptionCacheService } from './subscription-cache.service';
import { GatedContentGuard } from './gated-content.guard';

@Module({
  imports: [
    EventsModule,
    LoggingModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    SubscriptionChainReaderService,
    SubscriptionCacheService,
    GatedContentGuard,
    FanBearerGuard,
    {
      provide: SUBSCRIPTION_EVENT_PUBLISHER,
      useValue: { emit: () => undefined },
    },
  ],
  exports: [SubscriptionsService, GatedContentGuard, SubscriptionCacheService],
})
export class SubscriptionsModule {}
