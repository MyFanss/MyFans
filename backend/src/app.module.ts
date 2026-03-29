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
import { APP_GUARD } from '@nestjs/core';
import { LoggingModule } from './common/logging.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { CreatorsModule } from './creators/creators.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { AuthModule } from './auth-module/auth.module';
import { ModerationModule } from './moderation/moderation.module';

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
      .apply(CorrelationIdMiddleware, LoggingMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
