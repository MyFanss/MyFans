import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { AppModule } from './app.module';

/**
 * Test-only module used by e2e specs that need to boot the application
 * without a live database connection.
 *
 * It reuses the production AppModule wiring (config, throttler, domain
 * modules) but is intended to be imported by e2e suites that override the
 * TypeORM connection with an in-memory or mocked provider.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.test', '.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    AppModule,
  ],
})
export class AppTestModule {}
