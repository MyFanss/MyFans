import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Request, Response, NextFunction } from 'express';
import * as cookieParser from 'cookie-parser';
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

  // Apply security headers middleware
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

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
    next();
  });

  const probeService = app.get(StartupProbeService);

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
