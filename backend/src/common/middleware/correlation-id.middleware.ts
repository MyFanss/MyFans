import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RequestContextService } from '../services/request-context.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validUuid(value: string | undefined): string {
  return value && UUID_RE.test(value) ? value : uuidv4();
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(private readonly requestContextService: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = validUuid(req.headers['x-correlation-id'] as string | undefined);
    const requestId = validUuid(req.headers['x-request-id'] as string | undefined);

    req.headers['x-correlation-id'] = correlationId;
    req.headers['x-request-id'] = requestId;

    res.setHeader('x-correlation-id', correlationId);
    res.setHeader('x-request-id', requestId);

    // Seed AsyncLocalStorage so every downstream async call in this request
    // can read the correlation/request IDs without passing them explicitly.
    this.requestContextService.run(
      {
        correlationId,
        requestId,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip ?? 'unknown',
        userAgent: req.headers['user-agent'],
        userId: null,
      },
      () => next(),
    );
  }
}
