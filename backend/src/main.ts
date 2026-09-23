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

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const probeService = app.get(StartupProbeService);

  const config = new DocumentBuilder()
    .setTitle('MyFans API')
    .setDescription('MyFans backend REST API')
    .setVersion('1.0')
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
