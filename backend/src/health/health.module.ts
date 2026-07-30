import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { StartupProbeService } from './startup-probe.service';
import { SorobanRpcService } from '../common/services/soroban-rpc.service';
import { QueueMetricsService } from '../common/services/queue-metrics.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [TypeOrmModule.forFeature([]), MetricsModule],
  controllers: [HealthController],
  providers: [HealthService, StartupProbeService, SorobanRpcService, QueueMetricsService],
  exports: [HealthService, StartupProbeService],
})
export class HealthModule {}
