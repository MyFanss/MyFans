import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { IdempotencyKey } from './idempotency-key.entity';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyMiddleware } from './idempotency.middleware';
import { IdempotencyCleanupService } from './idempotency-cleanup.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IdempotencyKey]),
    ScheduleModule.forRoot(),
  ],
  providers: [IdempotencyService, IdempotencyMiddleware, IdempotencyCleanupService],
  exports: [IdempotencyService, IdempotencyMiddleware],
})
export class IdempotencyModule {}
