import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';

export const WEBHOOK_SIGNATURE_HEADER = 'x-webhook-signature';

interface WebhookRequest extends Request {
  rawBody?: Buffer | string;
}

@Injectable()
export class WebhookHmacMiddleware implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<WebhookRequest>();
    this.verify(req);
    return true;
  }

  use(req: WebhookRequest, _res: unknown, next: (err?: unknown) => void): void {
    try {
      this.verify(req);
      next();
    } catch (err) {
      next(err);
    }
  }

  private verify(req: WebhookRequest): void {
    const header = req.headers[WEBHOOK_SIGNATURE_HEADER];
    const signature = Array.isArray(header) ? header[0] : header;

    if (!signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const rawBody = req.rawBody;
    if (rawBody === undefined || rawBody === null) {
      throw new UnauthorizedException('Missing raw webhook body');
    }

    const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
    const provided = this.normalizeSignature(signature);

    const secrets = this.getSecrets();
    if (secrets.length === 0) {
      throw new UnauthorizedException('Webhook secret is not configured');
    }

    const valid = secrets.some((secret) => {
      const expected = createHmac('sha256', secret).update(payload).digest();
      return (
        expected.length === provided.length &&
        timingSafeEqual(expected, provided)
      );
    });

    if (!valid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  private normalizeSignature(signature: string): Buffer {
    const trimmed = signature.trim();
    const value = trimmed.startsWith('sha256=')
      ? trimmed.slice('sha256='.length)
      : trimmed;

    if (!/^[0-9a-fA-F]+$/.test(value) || value.length % 2 !== 0) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return Buffer.from(value, 'hex');
  }

  private getSecrets(): string[] {
    const secrets: string[] = [];
    const current = process.env.WEBHOOK_SECRET;
    const previous = process.env.WEBHOOK_SECRET_PREVIOUS;

    if (current) {
      secrets.push(current);
    }
    if (previous) {
      secrets.push(previous);
    }

    return secrets;
  }
}
