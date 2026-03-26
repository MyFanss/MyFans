import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { StartupProbeService } from './startup-probe.service';
import { SorobanRpcService } from '../common/services/soroban-rpc.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService, StartupProbeService, SorobanRpcService],
  exports: [HealthService, StartupProbeService],
})
export class HealthModule {}
