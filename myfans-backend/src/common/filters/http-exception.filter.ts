import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { STATUS_CODES } from 'http';
import { ErrorResponseDto } from '../dto/error-response.dto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const path = request.originalUrl;
    const isProduction = process.env.NODE_ENV === 'production';

    let status: number;
    let message: string | string[];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else {
        const body = exceptionResponse as Record<string, unknown>;
        const raw = body['message'];
        if (Array.isArray(raw)) {
          message = raw as string[];
        } else if (typeof raw === 'string') {
          message = raw;
        } else {
          message = exception.message;
        }
      }
    } else {
      this.logger.error(exception);
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = isProduction
        ? 'Internal server error'
        : exception instanceof Error
          ? exception.message
          : 'Unknown error';
    }

    const error = STATUS_CODES[status] ?? 'Unknown Error';
    const body = new ErrorResponseDto(status, error, message, path);
    response.status(status).json(body);
  }
}
