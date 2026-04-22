import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { RequestContextService } from './request-context.service';
import { redact } from '../utils/redact';

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

  private formatMessage(
    message: any,
    context?: string,
  ): { message: any; context: string } {
    const logContext = this.requestContextService.getLogContext();
    const contextString = context || 'Application';

    // Add request context to message if available
    if (Object.keys(logContext).length > 0) {
      const formattedMessage =
        typeof message === 'string' ? message : JSON.stringify(message);
      return {
        message: `${formattedMessage} [Context: ${JSON.stringify(logContext)}]`,
        context: contextString,
      };
    }

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      message,
      context: contextString,
    };
  }

  log(message: any, context?: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { message: formattedMessage, context: formattedContext } =
      this.formatMessage(message, context);
    this.logger.log(formattedMessage, formattedContext);
  }

  error(message: any, trace?: string, context?: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { message: formattedMessage, context: formattedContext } =
      this.formatMessage(message, context);
    this.logger.error(formattedMessage, trace, formattedContext);
  }

  warn(message: any, context?: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { message: formattedMessage, context: formattedContext } =
      this.formatMessage(message, context);
    this.logger.warn(formattedMessage, formattedContext);
  }

  debug(message: any, context?: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { message: formattedMessage, context: formattedContext } =
      this.formatMessage(message, context);
    this.logger?.debug?.(formattedMessage, formattedContext);
  }

  verbose(message: any, context?: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { message: formattedMessage, context: formattedContext } =
      this.formatMessage(message, context);
    this.logger?.verbose?.(formattedMessage, formattedContext);
  }

  // Method for structured logging
  logStructured(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,

    data?: unknown,
    context?: string,
  ) {
    const logContext = this.requestContextService.getLogContext();

    const redactedData = data !== undefined ? redact(data) : undefined;
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: context || 'Application',
      ...logContext,
      ...(redactedData !== undefined && { data: redactedData }),
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
