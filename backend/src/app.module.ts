import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerGuard } from './auth/throttler.guard';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { LoggingModule } from './common/logging.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { CreatorsModule } from './creators/creators.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 60000, limit: 10 },
      { name: 'medium', ttl: 60000, limit: 50 },
      { name: 'long', ttl: 60000, limit: 100 },
    ]),
    LoggingModule,
    AuthModule,
    CreatorsModule,
    SubscriptionsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, LoggingMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
