import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response, NextFunction } from 'express';
import { json, urlencoded } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { StartupProbeService } from './health/startup-probe.service';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { validateRequiredSecrets } from './common/secrets-validation';
import { CorsService } from './common/services/cors.service';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';

/**
 * Default maximum size (in bytes) for JSON and urlencoded request bodies.
 * Overridable via the MAX_JSON_BODY_BYTES environment variable.
 */
const DEFAULT_MAX_JSON_BODY_BYTES = 1 * 1024 * 1024; // 1 MiB

/**
 * Default maximum size (in bytes) for multipart uploads on /content/upload.
 * Overridable via the MAX_MULTIPART_BODY_BYTES environment variable.
 */
const DEFAULT_MAX_MULTIPART_BODY_BYTES = 25 * 1024 * 1024; // 25 MiB

/**
 * Route prefix that receives the larger multipart upload cap.
 */
const CONTENT_UPLOAD_PATH = '/content/upload';

/**
 * Global API version prefix. All public HTTP routes are served under /v1.
 * See backend/docs/API_VERSIONING.md for the deprecation and breaking-change
 * policy that governs future /v2 transitions.
 */
const API_GLOBAL_PREFIX = 'v1';

/**
 * Current API version advertised via the Deprecation/Sunset policy headers.
 */
const CURRENT_API_VERSION = '1';

/**
 * HTTP methods that mutate server state. These must never be reachable
 * without the /v1 version prefix.
 */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

/**
 * Returns true when the request targets a versioned public route (i.e. the
 * path is served under the /v1 global prefix).
 */
function isVersionedPath(path: string): boolean {
  return path === `/${API_GLOBAL_PREFIX}` || path.startsWith(`/${API_GLOBAL_PREFIX}/`);
}

async function bootstrap() {
  validateRequiredSecrets();

  const corsService = new CorsService();
  const corsOptions = corsService.getCorsOptions();

  const app = await NestFactory.create(AppModule, {
    cors: corsOptions,
    // Disable Nest's built-in body parser so we can install size-limited
    // parsers below, before any auth-heavy middleware runs.
    bodyParser: false,
  });

  const isProduction = process.env.NODE_ENV === 'production';

  const maxJsonBodyBytes = parsePositiveInt(
    process.env.MAX_JSON_BODY_BYTES,
    DEFAULT_MAX_JSON_BODY_BYTES,
  );
  const maxMultipartBodyBytes = parsePositiveInt(
    process.env.MAX_MULTIPART_BODY_BYTES,
    DEFAULT_MAX_MULTIPART_BODY_BYTES,
  );

  // Body size limits are installed first so oversized payloads are rejected
  // with HTTP 413 before any auth-heavy parsers or middleware run.
  // The /content/upload route gets a separate, larger multipart cap.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const isContentUpload = req.path.startsWith(CONTENT_UPLOAD_PATH);
    const limit = isContentUpload ? maxMultipartBodyBytes : maxJsonBodyBytes;
    const jsonParser = json({ limit });
    const urlencodedParser = urlencoded({ limit, extended: true });
    jsonParser(req, res, (jsonErr?: unknown) => {
      if (jsonErr) {
        next(jsonErr);
        return;
      }
      urlencodedParser(req, res, next);
    });
  });

  // Helmet provides a baseline set of security headers (dnsPrefetchControl,
  // frameguard, hidePoweredBy, hsts, ieNoOpen, noSniff, originAgentCluster,
  // permittedCrossDomainPolicies, referrerPolicy, xssFilter).
  // CSP and COEP/COOP/CORP are handled by SecurityHeadersMiddleware below so
  // that they can be environment-aware (dev vs. production CSP, etc.).
  app.use(
    helmet({
      // Disable headers that SecurityHeadersMiddleware manages with finer control
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
      // HSTS: only meaningful over TLS; SecurityHeadersMiddleware also sets it
      // in production, so let helmet handle it here as a belt-and-suspenders layer.
      hsts: isProduction
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    }),
  );

  // Apply project-specific security headers (CSP, COEP, COOP, CORP, etc.)
  const securityHeadersMiddleware = new SecurityHeadersMiddleware();
  app.use((req: Request, res: Response, next: NextFunction) =>
    securityHeadersMiddleware.use(req, res, next),
  );

  app.use(cookieParser());

  // Enforce the versioning contract: every public mutating route must be
  // served under the /v1 prefix. Unversioned mutating requests are rejected
  // with HTTP 404 so no unversioned mutating public route can exist.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (MUTATING_METHODS.has(req.method) && !isVersionedPath(req.path)) {
      res.status(404).json({
        statusCode: 404,
        error: 'Not Found',
        message: `API version prefix required. Use /${API_GLOBAL_PREFIX}${req.path}`,
      });
      return;
    }
    next();
  });

  // Advertise the current API version and the deprecation policy so clients
  // and forks can react before a future /v2 breaking change lands.
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-API-Version', CURRENT_API_VERSION);
    res.setHeader('X-API-Deprecation-Policy', 'https://docs.myfans.app/api-versioning');
    next();
  });

  // All public HTTP routes are served under the /v1 global prefix.
  app.setGlobalPrefix(API_GLOBAL_PREFIX);

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: CURRENT_API_VERSION,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const probeService = app.get(StartupProbeService);

  const config = new DocumentBuilder()
    .setTitle('MyFans API')
    .setDescription('MyFans backend REST API')
    .setVersion('1.0')
    .addServer(`/${API_GLOBAL_PREFIX}`, 'Versioned API (v1)')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  let dbResult: { ok: boolean; error?: string };
  try {
    const dataSource = app.get<DataSource>(getDataSourceToken());
    dbResult = await probeService.probeDb(() => dataSource.query('SELECT 1'));
  } catch {
    dbResult = { ok: true };
  }
  probeService.handleResult('DB', dbResult);

  const rpcResult = await probeService.probeRpc();
  probeService.handleResult('RPC', rpcResult);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
