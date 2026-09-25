import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { WebhookHmacMiddleware } from './webhooks/webhook-hmac.middleware';
import { RedactionExceptionFilter } from './common/logging/redaction.exception-filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Scrub secrets (JWTs, cookies, webhook secrets, payout fields) from any
  // exception output before it is returned or logged.
  app.useGlobalFilters(new RedactionExceptionFilter());

  // Enforce HMAC verification on inbound webhook routes before they reach
  // controllers. The middleware accepts both the current and previous secret
  // during a rotation window and rejects invalid or replayed requests.
  app.use('/webhooks', new WebhookHmacMiddleware().use.bind(new WebhookHmacMiddleware()));

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}

bootstrap();
