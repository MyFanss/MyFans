import { APP_GUARD } from '@nestjs/core';
import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ThrottlerGuard } from './auth/throttler.guard';
import { LoggingModule } from './common/logging.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { CreatorsModule } from './creators/creators.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { ModerationModule } from './moderation/moderation.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { IdempotencyMiddleware } from './idempotency/idempotency.middleware';

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
    ThrottlerModule.forRoot([{ name: 'auth', ttl: 60000, limit: 5 }]),
    LoggingModule,
    AuthModule,
    CreatorsModule,
    SubscriptionsModule,
    NotificationsModule,
    HealthModule,
    ModerationModule,
    IdempotencyModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, LoggingMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });

    consumer
      .apply(IdempotencyMiddleware)
      .forRoutes(...IDEMPOTENCY_ROUTES);
  }
}
