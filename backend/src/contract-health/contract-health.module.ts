import { Module } from '@nestjs/common';
import { ContractHealthService } from './contract-health.service';

@Module({
  providers: [ContractHealthService],
  exports: [ContractHealthService],
})
export class ContractHealthModule {}
