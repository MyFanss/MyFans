import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { loggerConfig } from './logger/logger.config';

@Module({
    imports: [WinstonModule.forRoot(loggerConfig)],
    exports: [WinstonModule],
})
export class LoggingModule { }
