import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { loggerConfig } from './logger/logger.config';
import { RequestContextService } from './services/request-context.service';
import { LoggerService } from './services/logger.service';

@Module({
    imports: [WinstonModule.forRoot(loggerConfig)],
    providers: [RequestContextService, LoggerService],
    exports: [WinstonModule, RequestContextService, LoggerService],
})
export class LoggingModule { }
