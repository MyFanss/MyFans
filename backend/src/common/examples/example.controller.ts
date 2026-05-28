import { Controller, Get, Req } from '@nestjs/common';
import { LoggerService } from '../services/logger.service';
import { RequestContextService } from '../services/request-context.service';
import type { Request } from 'express';

@Controller({ path: 'example', version: '1' })
export class ExampleController {
    constructor(
        private readonly logger: LoggerService,
        private readonly requestContextService: RequestContextService,
    ) {}

    @Get()
    getExample(@Req() req: Request) {
        // Using the custom logger service that automatically includes request context
        this.logger.log('Processing example request', 'ExampleController');

        // Using structured logging
        this.logger.logStructured(
            'info',
            'Example request processed',
            { action: 'get_example', timestamp: new Date().toISOString() },
            'ExampleController'
        );

        // Manual access to request context
        const context = this.requestContextService.getLogContext();
        this.logger.log(`Request context: ${JSON.stringify(context)}`, 'ExampleController');

        return {
            message: 'Example response',
            correlationId: this.requestContextService.getCorrelationId(),
            requestId: this.requestContextService.getRequestId(),
        };
    }

    @Get('error')
    getError() {
        this.logger.error('This is a test error', '', 'ExampleController');
        this.logger.logStructured(
            'error',
            'Test error occurred',
            { error: 'Test error', details: 'This is a test error message' },
            'ExampleController'
        );
        
        throw new Error('Test error');
    }
}
