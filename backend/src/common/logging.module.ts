import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { loggerConfig } from './logger/logger.config';
import { RequestContextService } from './services/request-context.service';
import { LoggerService } from './services/logger.service';
import { QueueMetricsService } from './services/queue-metrics.service';
import { JobLoggerService } from './services/job-logger.service';
import { HttpMetricsService } from './services/http-metrics.service';

@Module({
    imports: [WinstonModule.forRoot(loggerConfig)],
    providers: [RequestContextService, LoggerService, QueueMetricsService, JobLoggerService, HttpMetricsService],
    exports: [WinstonModule, RequestContextService, LoggerService, QueueMetricsService, JobLoggerService, HttpMetricsService],
})
export class LoggingModule { }
