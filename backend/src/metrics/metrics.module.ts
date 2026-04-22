import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { HttpMetricsService } from '../common/services/http-metrics.service';

@Module({
  controllers: [MetricsController],
  providers: [HttpMetricsService],
  exports: [HttpMetricsService],
})
export class MetricsModule {}
