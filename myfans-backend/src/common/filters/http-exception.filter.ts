import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isProduction = process.env.NODE_ENV === 'production';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      const body =
        typeof exceptionResponse === 'object'
          ? { ...exceptionResponse }
          : { message: exceptionResponse };

      if (isProduction && 'stack' in body) {
        delete (body as Record<string, unknown>).stack;
      }

      response.status(status).json(body);
    } else {
      this.logger.error(exception);

      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: isProduction
          ? 'Internal server error'
          : exception instanceof Error
            ? exception.message
            : 'Unknown error',
        error: 'Internal Server Error',
      });
    }
  }
}
