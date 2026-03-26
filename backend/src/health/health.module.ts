import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { SorobanRpcService } from '../common/services/soroban-rpc.service';
import { LoggingModule } from '../common/logging.module';

@Module({
    imports: [LoggingModule],
    controllers: [HealthController],
    providers: [HealthService, SorobanRpcService],
})
export class HealthModule { }
