import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestContextService } from '../services/request-context.service';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
    private readonly logger = new Logger('HTTP');

    constructor(private readonly requestContextService: RequestContextService) {}

    private redact(obj: any): any {
        if (!obj || typeof obj !== 'object') return obj;
        const redacted = { ...obj };
        const sensitiveKeys = ['password', 'token', 'refresh_token', 'authorization'];

        for (const key of Object.keys(redacted)) {
            if (sensitiveKeys.includes(key.toLowerCase())) {
                redacted[key] = '***REDACTED***';
            } else if (typeof redacted[key] === 'object') {
                redacted[key] = this.redact(redacted[key]);
            }
        }
        return redacted;
    }

    use(req: Request, res: Response, next: NextFunction) {
        const { method, originalUrl, ip, body, headers } = req;
        const startTime = Date.now();
        const correlationId = req.headers['x-correlation-id'];
        const requestId = req.headers['x-request-id'];

        const redactedHeaders = this.redact(headers);
        const redactedBody = this.redact(body);

        this.logger.log(
            `[${correlationId}] [${requestId}] Incoming Request: ${method} ${originalUrl} - IP: ${ip} - Headers: ${JSON.stringify(redactedHeaders)} - Body: ${JSON.stringify(redactedBody)}`,
        );

        // Set up cleanup on response finish
        res.on('finish', () => {
            const { statusCode } = res;
            const duration = Date.now() - startTime;
            const userId = (req as any).user?.id || 'anonymous';

            const message = `[${correlationId}] [${requestId}] Outgoing Response: ${method} ${originalUrl} - Status: ${statusCode} - Duration: ${duration}ms - User: ${userId}`;

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
