import { Module } from '@nestjs/common';
import { StartupProbeService } from './startup-probe.service';

@Module({
  providers: [StartupProbeService],
  exports: [StartupProbeService],
})
export class HealthModule {}
