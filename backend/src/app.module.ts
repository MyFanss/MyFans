import { APP_GUARD } from '@nestjs/core';
import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth-module/auth.module';
import { ThrottlerGuard } from './auth/throttler.guard';
import { JwtAuthGuard } from './auth-module/guards/jwt-auth.guard';
import { RolesGuard } from './auth-module/guards/roles.guard';
import { PublicGuard } from './auth-module/guards/public.guard';
import { LoggingModule } from './common/logging.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { MetricsMiddleware } from './common/middleware/metrics.middleware';
import { CreatorsModule } from './creators/creators.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { ModerationModule } from './moderation/moderation.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { IdempotencyMiddleware } from './idempotency/idempotency.middleware';
import { ReferralModule } from './referral/referral.module';

/** Routes where idempotency protection is enforced. */
const IDEMPOTENCY_ROUTES = [
  { path: 'v1/creators/plans', method: RequestMethod.POST },
  { path: 'v1/subscriptions/checkout', method: RequestMethod.POST },
  { path: 'v1/posts', method: RequestMethod.POST },
  { path: 'v1/posts/:id', method: RequestMethod.PUT },
  { path: 'v1/comments', method: RequestMethod.POST },
  { path: 'v1/comments/:id', method: RequestMethod.PUT },
  { path: 'v1/conversations', method: RequestMethod.POST },
  { path: 'v1/conversations/:id/messages', method: RequestMethod.POST },
];

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 60000, limit: 10 },
      { name: 'medium', ttl: 60000, limit: 50 },
      { name: 'long', ttl: 60000, limit: 100 },
    ]),
    LoggingModule,
    MetricsModule,
    AuthModule,
    CreatorsModule,
    SubscriptionsModule,
    NotificationsModule,
    HealthModule,
    ModerationModule,
    IdempotencyModule,
    ReferralModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PublicGuard },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, LoggingMiddleware, MetricsMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });

    consumer
      .apply(IdempotencyMiddleware)
      .forRoutes(...IDEMPOTENCY_ROUTES);
  }
}
