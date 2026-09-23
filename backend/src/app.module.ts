import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// Canonical auth/users stack. Historical duplicate stacks were removed.
import { AuthModule } from './auth-module/auth.module';
import { UsersModule } from './users/users.module';
import { OpenAPIController } from './common/openapi-publish.controller';
import { ThrottlerGuard } from './common/guards/throttler.guard';
import { JwtAuthGuard } from './auth-module/guards/jwt-auth.guard';
import { RolesGuard } from './auth-module/guards/roles.guard';
import { LoggingModule } from './common/logging.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { MetricsMiddleware } from './common/middleware/metrics.middleware';
import { CreatorsModule } from './creators/creators.module';
import { PlansModule } from './plans/plans.module';
import { EventsModule } from './events/events.module';
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
  { path: 'v1/plans', method: RequestMethod.POST },
  { path: 'v1/plans/:planId', method: RequestMethod.PUT },
  { path: 'v1/plans/:planId', method: RequestMethod.DELETE },
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

/**
 * Route classes for rate limiting.
 *
 * - `auth`   — strict: authentication challenges (login, register, password
 *              reset, token refresh). 5 requests/min per key.
 * - `upload` — strict: uploads and other CPU/bandwidth-heavy writes.
 * - `read`   — loose: general read traffic.
 * - `short` / `medium` / `long` — legacy buckets kept for backwards
 *              compatibility with existing @Throttle() decorators.
 *
 * When REDIS_URL is configured the throttler uses a shared Redis store so
 * counters are consistent across instances (required for HA / horizontal
 * scale). Without REDIS_URL it falls back to the in-memory store, which is
 * only safe for single-instance deployments.
 */
const THROTTLER_TIERS = [
  { name: 'auth', ttl: 60000, limit: 5 },
  { name: 'upload', ttl: 60000, limit: 10 },
  { name: 'read', ttl: 60000, limit: 300 },
  { name: 'short', ttl: 60000, limit: 10 },
  { name: 'medium', ttl: 60000, limit: 50 },
  { name: 'long', ttl: 60000, limit: 100 },
];

const redisUrl = process.env.REDIS_URL;

/**
 * Parse the CORS origin allowlist from the environment.
 *
 * `CORS_ORIGINS` is a comma-separated list of exact origins (scheme + host +
 * optional port), e.g. `https://app.example.com,https://staging.example.com`.
 * Preview deploys can append their own origin without code changes. A single
 * `*` entry is preserved so the boot guard below can reject the unsafe
 * wildcard-with-credentials combination in production.
 */
function parseCorsOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

const corsOrigins = parseCorsOrigins();
const corsCredentials =
  (process.env.CORS_CREDENTIALS ?? 'true').toLowerCase() !== 'false';
const isProduction = process.env.NODE_ENV === 'production';

// Fail fast: reflecting arbitrary origins while sending credentials lets any
// site read authenticated responses. Never allow `*` + credentials in prod.
if (isProduction && corsCredentials && corsOrigins.includes('*')) {
  throw new Error(
    'Invalid CORS configuration: CORS_ORIGINS="*" cannot be combined with ' +
      'credentials in production. Set CORS_ORIGINS to an explicit allowlist ' +
      'of trusted origins (see backend/docs/CORS_AND_SECURITY_HEADERS.md).',
  );
}

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: THROTTLER_TIERS,
      ...(redisUrl
        ? { storage: new ThrottlerStorageRedisService(redisUrl) }
        : {}),
    }),
    LoggingModule,
    MetricsModule,
    AuthModule,
    UsersModule,
    CreatorsModule,
    PlansModule,
    EventsModule,
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
    RequestContextService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: CorrelationExceptionFilter },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, LoggingMiddleware, MetricsMiddleware)
      .forRoutes('*');

    consumer
      .apply(IdempotencyMiddleware)
      .forRoutes(...IDEMPOTENCY_ROUTES);

    consumer.apply(CsrfMiddleware).forRoutes(...CSRF_ROUTES);
  }
}
