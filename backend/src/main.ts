import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { WebhookHmacMiddleware } from './webhooks/webhook-hmac.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Enforce HMAC verification on inbound webhook routes before they reach
  // controllers. The middleware accepts both the current and previous secret
  // during a rotation window and rejects invalid or replayed requests.
  app.use('/webhooks', new WebhookHmacMiddleware().use.bind(new WebhookHmacMiddleware()));

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}

bootstrap();
