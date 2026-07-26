import { Module } from '@nestjs/common';
import { NetworkConfigController } from './network-config.controller';
import { NetworkConfigService } from './network-config.service';

@Module({
  controllers: [NetworkConfigController],
  providers: [NetworkConfigService],
  exports: [NetworkConfigService],
})
export class NetworkConfigModule {}
