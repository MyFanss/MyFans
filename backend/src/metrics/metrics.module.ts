import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MetricsController } from './metrics.controller';
import { MetricsGuard } from './metrics.guard';
import { HttpMetricsService } from '../common/services/http-metrics.service';
import { RpcMetricsService } from '../common/services/rpc-metrics.service';
import { BusinessMetricsService } from './business-metrics.service';
import { ModerationModule } from '../moderation/moderation.module';

@Module({
  imports: [ConfigModule, ModerationModule],
  controllers: [MetricsController],
  providers: [HttpMetricsService, RpcMetricsService, BusinessMetricsService, MetricsGuard],
  exports: [HttpMetricsService, RpcMetricsService, BusinessMetricsService],
})
export class MetricsModule {}
