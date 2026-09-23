import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

/**
 * Parse the CORS origin allowlist from the environment.
 *
 * CORS_ORIGINS is a comma-separated list of allowed origins, e.g.
 *   CORS_ORIGINS=https://app.example.com,https://staging.example.com
 * Preview deploys can be added per environment without code changes.
 * A single '*' is preserved so the wildcard guard below can reject it in prod.
 */
function resolveCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS ?? '';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function resolveCorsCredentials(): boolean {
  return process.env.CORS_CREDENTIALS === 'true';
}

/**
 * Fail fast when production is configured with a wildcard origin together with
 * credentials. Browsers reject `Access-Control-Allow-Origin: *` when
 * `Access-Control-Allow-Credentials: true`, and reflecting arbitrary origins
 * would defeat the allowlist. Refuse to boot instead of silently misbehaving.
 */
function assertCorsConfig(origins: string[], credentials: boolean): void {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && credentials && origins.includes('*')) {
    throw new Error(
      'Invalid CORS configuration: CORS_ORIGINS="*" cannot be combined with ' +
        'CORS_CREDENTIALS=true in production. Provide an explicit origin allowlist.',
    );
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const corsOrigins = resolveCorsOrigins();
  const corsCredentials = resolveCorsCredentials();
  assertCorsConfig(corsOrigins, corsCredentials);

  app.use(new CorrelationIdMiddleware().use.bind(new CorrelationIdMiddleware()));

  // Helmet defaults: sensible security headers (CSP, HSTS, X-Content-Type-Options,
  // X-Frame-Options, Referrer-Policy, etc.). CSP connect-src is aligned with the
  // frontend SECURITY_HEADERS.md expectations via CORS_ORIGINS.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", ...corsOrigins.filter((origin) => origin !== '*')],
        },
      },
    }),
  );

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: corsCredentials,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
