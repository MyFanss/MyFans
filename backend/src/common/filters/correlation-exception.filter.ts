import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { RequestContextService } from '../services/request-context.service';

@Catch()
export class CorrelationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(CorrelationExceptionFilter.name);

  constructor(private readonly requestContext: RequestContextService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    const correlationId =
      this.requestContext.getCorrelationId() ??
      (req.headers['x-correlation-id'] as string | undefined);

    this.logger.error(
      JSON.stringify({
        event: 'request.error',
        status,
        message,
        correlationId,
        method: req.method,
        url: req.originalUrl,
        timestamp: new Date().toISOString(),
      }),
    );

    const body: Record<string, unknown> = { statusCode: status, message };

    // Include correlationId in the response body only outside production
    // so developers can cross-reference logs without leaking internals.
    if (process.env.NODE_ENV !== 'production' && correlationId) {
      body.correlationId = correlationId;
    }

    res.status(status).json(body);
  }
}
