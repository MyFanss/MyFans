import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ContentModule } from './content/content.module';
import { PostsModule } from './posts/posts.module';
import { MetricsModule } from './metrics/metrics.module';
import { MetricsService } from './metrics/metrics.service';
import { LedgerClockService } from './ledger-clock/ledger-clock.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Prometheus scrape endpoint. Kept outside the global 'v1' prefix so
  // scrapers can hit the conventional /metrics path. Restrict access at the
  // network layer (or via METRICS_TOKEN) in production.
  const metrics = app.get(MetricsService, { strict: false });
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/metrics', async (_req: unknown, res: any) => {
    const token = process.env.METRICS_TOKEN;
    if (token) {
      const provided = (_req as any)?.headers?.['x-metrics-token'];
      if (provided !== token) {
        res.status(401).send('unauthorized');
        return;
      }
    }
    res.setHeader('Content-Type', metrics.contentType());
    res.send(await metrics.render());
  });

  // Ledger clock health probe. Reports whether the ledger clock is readable
  // and within the skew budget. Fails closed: an untrusted clock reports 503
  // so gated access is denied upstream.
  const ledgerClock = app.get(LedgerClockService, { strict: false });
  httpAdapter.get('/health/ledger-clock', async (_req: unknown, res: any) => {
    const trusted = await ledgerClock.isClockTrusted();
    if (!trusted) {
      res.status(503).json({ trusted: false });
      return;
    }
    res.status(200).json({ trusted: true });
  });

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}

bootstrap();
