import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { SorobanRpcService } from '../common/services/soroban-rpc.service';

@Module({
    controllers: [HealthController],
    providers: [HealthService, SorobanRpcService],
})
export class HealthModule { }
