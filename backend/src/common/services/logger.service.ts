import { Inject, Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';
import { RequestContextService } from './request-context.service';
import { redact } from '../utils/redact';
import { LOG_FIELDS } from '../logger/log-fields';

@Injectable()
export class LoggerService implements NestLoggerService {
  constructor(
    private readonly requestContextService: RequestContextService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: WinstonLogger,
  ) {}

  private meta(context?: string): Record<string, unknown> {
    return {
      [LOG_FIELDS.CONTEXT]: context ?? 'Application',
      ...this.requestContextService.getLogContext(),
    };
  }

  /**
   * Convert a message to string, redacting sensitive data if it's an object.
   * Strings are logged as-is (assumed to be safe by caller).
   * Objects are redacted before JSON stringification to prevent PII/secrets leakage.
   */
  private sanitizeMessage(message: any): string {
    if (typeof message === 'string') {
      return message;
    }
    const redactedMessage = redact(message);
    return JSON.stringify(redactedMessage);
  }

  log(message: any, context?: string) {
    this.logger.info(this.sanitizeMessage(message), this.meta(context));
  }

  error(message: any, trace?: string, context?: string) {
    this.logger.error(this.sanitizeMessage(message), { ...this.meta(context), ...(trace ? { trace } : {}) });
    this.logger.error(
      typeof message === 'string' ? message : JSON.stringify(message),
      { ...this.meta(context), ...(trace ? { [LOG_FIELDS.TRACE]: trace } : {}) },
    );
  }

  warn(message: any, context?: string) {
    this.logger.warn(this.sanitizeMessage(message), this.meta(context));
  }

  debug(message: any, context?: string) {
    this.logger.debug(this.sanitizeMessage(message), this.meta(context));
  }

  verbose(message: any, context?: string) {
    this.logger.verbose(this.sanitizeMessage(message), this.meta(context));
  }

  /**
   * Emit a structured log entry using the canonical LOG_FIELDS standard.
   * `data` is automatically redacted before logging.
   */
  logStructured(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    data?: unknown,
    context?: string,
  ) {
    const redactedData = data !== undefined ? redact(data) : undefined;
    this.logger.log(level, message, {
      ...this.meta(context),
      ...(redactedData !== undefined && { [LOG_FIELDS.DATA]: redactedData }),
    });
  }
}
