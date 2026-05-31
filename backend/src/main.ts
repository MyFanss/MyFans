import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Request, Response, NextFunction } from 'express';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { StartupProbeService } from './health/startup-probe.service';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { validateRequiredSecrets } from './common/secrets-validation';
import { CorsService } from './common/services/cors.service';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';

async function bootstrap() {
  validateRequiredSecrets();

  const corsService = new CorsService();
  const corsOptions = corsService.getCorsOptions();

  const app = await NestFactory.create(AppModule, {
    cors: corsOptions,
  });

  const isProduction = process.env.NODE_ENV === 'production';

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

  // Setup Swagger/OpenAPI documentation
  const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');
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
