import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { WebhookService } from './webhook.service';
import { BusinessMetricsService } from '../metrics/business-metrics.service';

@Injectable()
export class WebhookGuard implements CanActivate {
  constructor(
    private readonly webhookService: WebhookService,
    @Optional() private readonly businessMetrics?: BusinessMetricsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const signature = req.headers['x-webhook-signature'];

    if (!signature || typeof signature !== 'string') {
      this.businessMetrics?.incrementHmacFailures();
      throw new UnauthorizedException('Missing webhook signature');
    }

    const rawBody: Buffer | undefined = (req as Request & { rawBody?: Buffer }).rawBody;
    const payload = rawBody ? rawBody.toString('utf8') : JSON.stringify(req.body);

    if (!this.webhookService.verify(payload, signature)) {
      this.businessMetrics?.incrementHmacFailures();
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }
}
