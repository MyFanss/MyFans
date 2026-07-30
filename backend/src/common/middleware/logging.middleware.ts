import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestContextService } from '../services/request-context.service';
import { redact } from '../utils/redact';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly requestContextService: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const body = req.body as Record<string, unknown>;
    const headers = req.headers as Record<string, unknown>;
    const startTime = Date.now();
    const correlationId = String(req.headers['x-correlation-id'] ?? '');
    const requestId = String(req.headers['x-request-id'] ?? '');

    const redactedHeaders = redact(headers);
    const redactedBody = redact(body);

    this.logger.log(
      `[${correlationId}] [${requestId}] Incoming Request: ${method} ${originalUrl} - IP: ${ip ?? ''} - Headers: ${JSON.stringify(redactedHeaders)} - Body: ${JSON.stringify(redactedBody)}`,
    );

    // Store response data by intercepting json() and send() methods
    let responseBody: unknown = undefined;
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    res.json = function (data: any) {
      responseBody = data;
      return originalJson(data);
    };

    res.send = function (data: any) {
      // Try to parse if string looks like JSON
      if (typeof data === 'string' && data.startsWith('{')) {
        try {
          responseBody = JSON.parse(data);
        } catch {
          responseBody = data;
        }
      } else {
        responseBody = data;
      }
      return originalSend(data);
    };

    // Set up cleanup on response finish
    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;
      const user = (req as Request & { user?: { id?: string } }).user;
      const userId = user?.id ?? 'anonymous';

      // Redact response body if available
      const redactedResponse = responseBody !== undefined ? redact(responseBody) : undefined;
      const responseLog =
        redactedResponse !== undefined
          ? `${JSON.stringify(redactedResponse)}`
          : '(no body)';

      const message = `[${correlationId}] [${requestId}] Outgoing Response: ${method} ${originalUrl} - Status: ${statusCode} - Duration: ${duration}ms - User: ${userId} - Body: ${responseLog}`;

      if (statusCode >= 500) {
        this.logger.error(message);
      } else if (statusCode >= 400) {
        this.logger.warn(message);
      } else {
        this.logger.log(message);
      }

      // Clean up context after response is sent
      this.requestContextService.clearContext();
    });

    // Also clean up on close (in case connection is interrupted)
    res.on('close', () => {
      this.requestContextService.clearContext();
    });

    next();
  }
}
