import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { RequestContextService } from './request-context.service';

@Injectable()
export class LoggerService implements NestLoggerService {
    private logger: NestLoggerService;

    constructor(private readonly requestContextService: RequestContextService) {
        this.logger = new (class implements NestLoggerService {
            log(message: any, context?: string) {
                console.log(`[${context}] ${message}`);
            }
            error(message: any, trace?: string, context?: string) {
                console.error(`[${context}] ${message}`, trace);
            }
            warn(message: any, context?: string) {
                console.warn(`[${context}] ${message}`);
            }
            debug(message: any, context?: string) {
                console.debug(`[${context}] ${message}`);
            }
            verbose(message: any, context?: string) {
                console.log(`[${context}] ${message}`);
            }
        })();
    }

    private formatMessage(message: any, context?: string): { message: any; context: string } {
        const logContext = this.requestContextService.getLogContext();
        const contextString = context || 'Application';
        
        // Add request context to message if available
        if (Object.keys(logContext).length > 0) {
            const formattedMessage = typeof message === 'string' ? message : JSON.stringify(message);
            return {
                message: `${formattedMessage} [Context: ${JSON.stringify(logContext)}]`,
                context: contextString
            };
        }

        return {
            message,
            context: contextString
        };
    }

    log(message: any, context?: string) {
        const { message: formattedMessage, context: formattedContext } = this.formatMessage(message, context);
        this.logger.log(formattedMessage, formattedContext);
    }

    error(message: any, trace?: string, context?: string) {
        const { message: formattedMessage, context: formattedContext } = this.formatMessage(message, context);
        this.logger.error(formattedMessage, trace, formattedContext);
    }

    warn(message: any, context?: string) {
        const { message: formattedMessage, context: formattedContext } = this.formatMessage(message, context);
        this.logger.warn(formattedMessage, formattedContext);
    }

    debug(message: any, context?: string) {
        const { message: formattedMessage, context: formattedContext } = this.formatMessage(message, context);
        this.logger?.debug?.(formattedMessage, formattedContext);
    }

    verbose(message: any, context?: string) {
        const { message: formattedMessage, context: formattedContext } = this.formatMessage(message, context);
        this.logger?.verbose?.(formattedMessage, formattedContext);
    }

    // Method for structured logging
    logStructured(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any, context?: string) {
        const logContext = this.requestContextService.getLogContext();
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context: context || 'Application',
            ...logContext,
            ...(data && { data })
        };

        // In production, this would be handled by Winston's JSON format
        // For now, we'll format it for console output
        const formattedMessage = JSON.stringify(logEntry);
        
        switch (level) {
            case 'error':
                this.logger.error(formattedMessage, '', context);
                break;
            case 'warn':
                this.logger.warn(formattedMessage, context);
                break;
            case 'debug':
                this.logger?.debug?.(formattedMessage, context);
                break;
            default:
                this.logger.log(formattedMessage, context);
        }
    }
}
