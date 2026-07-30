import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface CommentErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  timestamp: string;
  path: string;
}

// Machine-readable error codes are SCREAMING_SNAKE_CASE.
const MACHINE_ERROR_CODE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;

@Catch()
export class CommentsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(CommentsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message = 'Internal server error';
    let error: string | undefined;

    if (exception instanceof HttpException) {
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const resp = exceptionResponse as Record<string, unknown>;
        message =
          typeof resp.message === 'string'
            ? resp.message
            : Array.isArray(resp.message)
              ? resp.message.join('; ')
              : exception.message;
        // Keep a caller-supplied machine code (e.g. VALIDATION_FAILED) but drop
        // Nest's human reason phrases ("Bad Request") so statusToError below
        // yields the stable code clients actually match on.
        if (
          typeof resp.error === 'string' &&
          MACHINE_ERROR_CODE.test(resp.error)
        ) {
          error = resp.error;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (!error || error === message) {
      error = this.statusToError(status);
    }

    const body: CommentErrorResponse = {
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: req.url,
    };

    this.logger.warn(`${req.method} ${req.url} ${status} – ${message}`);

    res.status(status).json(body);
  }

  private statusToError(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
    };
    return map[status] ?? 'UNKNOWN_ERROR';
  }
}
