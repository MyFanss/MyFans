import { ValidationPipe } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';

export function applyAppConfig(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
}
