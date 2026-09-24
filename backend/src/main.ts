import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ContentModule } from './content/content.module';
import { PostsModule } from './posts/posts.module';
import { MetricsModule } from './metrics/metrics.module';
import { MetricsService } from './metrics/metrics.service';

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

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}

bootstrap();
