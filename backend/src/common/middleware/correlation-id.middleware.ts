import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RequestContextService } from '../services/request-context.service';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
    constructor(private readonly requestContextService: RequestContextService) {}

    use(req: Request, res: Response, next: NextFunction) {
        const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
        const requestId = (req.headers['x-request-id'] as string) || uuidv4();
        
        // Store in headers
        req.headers['x-correlation-id'] = correlationId;
        req.headers['x-request-id'] = requestId;
        
        // Set response headers
        res.setHeader('x-correlation-id', correlationId);
        res.setHeader('x-request-id', requestId);
        
        // Store in request context service
        this.requestContextService.setContext({
            correlationId,
            requestId,
            method: req.method,
            url: req.originalUrl,
            ip: req.ip || 'unknown',
            userAgent: req.headers['user-agent'],
            userId: null, // Will be set by auth middleware if available
        });
        
        next();
    }
}
