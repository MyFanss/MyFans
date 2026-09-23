import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// Canonical auth/users stack. Historical duplicate stacks were removed.
import { AuthModule } from './auth-module/auth.module';
import { OpenAPIController } from './common/openapi-publish.controller';
import { ThrottlerGuard } from './common/guards/throttler.guard';
import { JwtAuthGuard } from './auth-module/guards/jwt-auth.guard';
import { RolesGuard } from './auth-module/guards/roles.guard';
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
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { ReferralModule } from './referral/referral.module';
import { CsrfModule } from './csrf/csrf.module';
import { SocialLinksModule } from './social-link/social-links.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { EarningsModule } from './earnings/earnings.module';
import { FavoritesModule } from './favorites/favorites.module';
import { FeedModule } from './feed/feed.module';
import { CommentsModule } from './comments/comments.module';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { CorrelationExceptionFilter } from './common/filters/correlation-exception.filter';
import { RequestContextService } from './common/services/request-context.service';
import { ContentModule } from './content/content.module';
import { NetworkConfigModule } from './config/network-config.module';
import { PostsModule } from './posts/posts.module';
import { WebhookModule } from './webhook/webhook.module';

/**
 * Routes where idempotency protection is enforced.
 *
 * Money paths (checkout confirm, subscription mutations, payouts) require an
 * `Idempotency-Key` header end-to-end: the middleware stores hash(body)+response
 * keyed by the header value, replays the cached response for a repeated
 * key+body, and returns 409 when the same key is reused with a different body.
 */
const IDEMPOTENCY_ROUTES = [
  { path: 'v1/creators/plans', method: RequestMethod.POST },
  { path: 'v1/subscriptions/checkout', method: RequestMethod.POST },
  { path: 'v1/subscriptions/checkout/confirm', method: RequestMethod.POST },
  { path: 'v1/subscriptions/:id/cancel', method: RequestMethod.POST },
  { path: 'v1/subscriptions/:id/resume', method: RequestMethod.POST },
  { path: 'v1/earnings/payouts', method: RequestMethod.POST },
  { path: 'v1/posts', method: RequestMethod.POST },
  { path: 'v1/posts/:id', method: RequestMethod.PUT },
  { path: 'v1/comments', method: RequestMethod.POST },
  { path: 'v1/comments/:id', method: RequestMethod.PUT },
  { path: 'v1/conversations', method: RequestMethod.POST },
  { path: 'v1/conversations/:id/messages', method: RequestMethod.POST },
  { path: 'v1/content', method: RequestMethod.POST },
  { path: 'v1/webhook', method: RequestMethod.POST },
  // Earnings withdraw uses the prepare/confirm pattern; both legs must be
  // idempotent so a retried confirm cannot double-pay a creator.
  { path: 'v1/earnings/withdraw/prepare', method: RequestMethod.POST },
  { path: 'v1/earnings/withdraw/confirm', method: RequestMethod.POST },
];

/**
 * State-mutating /v1 routes that must be protected by the CSRF
 * double-submit cookie check. Critical routes (e.g. checkout) are
 * intentionally included and must never be exempted.
 */
const CSRF_ROUTES = [
  { path: 'v1/*', method: RequestMethod.POST },
  { path: 'v1/*', method: RequestMethod.PUT },
  { path: 'v1/*', method: RequestMethod.PATCH },
  { path: 'v1/*', method: RequestMethod.DELETE },
];

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'auth', ttl: 60000, limit: 5 },
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
    FeatureFlagsModule,
    ReferralModule,
    CsrfModule,
    SocialLinksModule,
    AnalyticsModule,
    EarningsModule,
    FavoritesModule,
    FeedModule,
    CommentsModule,
    ContentModule,
    NetworkConfigModule,
    PostsModule,
    WebhookModule,
  ],
  controllers: [AppController, OpenAPIController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // JwtAuthGuard authenticates every route unless it opts out with @Public();
    // RolesGuard then enforces @Roles() on the routes that declare one.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    RequestContextService,
    {
      provide: APP_FILTER,
      useClass: CorrelationExceptionFilter,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, LoggingMiddleware, MetricsMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });

    consumer.apply(IdempotencyMiddleware).forRoutes(...IDEMPOTENCY_ROUTES);

    // CSRF double-submit cookie protection on all state-mutating /v1 routes.
    // The middleware enforces the header only for cookie-based auth, so
    // Bearer-only native/mobile clients are unaffected (documented exception).
    consumer.apply(CsrfMiddleware).forRoutes(...CSRF_ROUTES);
  }
}
