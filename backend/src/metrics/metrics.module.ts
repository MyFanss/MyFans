import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { HttpMetricsService } from '../common/services/http-metrics.service';
import { ModerationModule } from '../moderation/moderation.module';

@Module({
  imports: [ModerationModule],
  controllers: [MetricsController],
  providers: [HttpMetricsService],
  exports: [HttpMetricsService],
})
export class MetricsModule {}
