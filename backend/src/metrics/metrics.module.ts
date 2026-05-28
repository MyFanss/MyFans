import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { HttpMetricsService } from '../common/services/http-metrics.service';
import { RpcMetricsService } from '../common/services/rpc-metrics.service';
import { ModerationModule } from '../moderation/moderation.module';

@Module({
  imports: [ModerationModule],
  controllers: [MetricsController],
  providers: [HttpMetricsService, RpcMetricsService],
  exports: [HttpMetricsService, RpcMetricsService],
})
export class MetricsModule {}
