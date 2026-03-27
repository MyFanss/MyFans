import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WebhookGuard } from './webhook.guard';
import { WebhookService } from './webhook.service';
import { AuditService } from '../audit/audit.service';
import { AuditableAction } from '../audit/auditable-action';

@Controller({ path: 'webhook', version: '1' })
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly auditService: AuditService,
  ) {}

  /** Receive an incoming signed webhook event. */
  @Post()
  @HttpCode(200)
  @UseGuards(WebhookGuard)
  receive(@Body() body: unknown) {
    return { received: true, payload: body };
  }

  /**
   * Rotate the active signing secret.
   * Body: { newSecret: string; cutoffMs?: number }
   * In production, protect this endpoint with an admin/JWT guard.
   */
  @Post('rotate')
  @HttpCode(200)
  rotate(@Body() body: { newSecret: string; cutoffMs?: number }) {
    this.webhookService.rotate(body.newSecret, body.cutoffMs);
    void this.auditService.record({
      action: AuditableAction.WEBHOOK_SECRET_ROTATED,
      actorType: 'system',
      metadata: {
        cutoffMs: body.cutoffMs ?? 24 * 60 * 60 * 1000,
        rotated: true,
      },
    });
    const state = this.webhookService.getState();
    return {
      rotated: true,
      cutoffAt: state.cutoffAt,
      hasPrevious: !!state.previous,
    };
  }

  /** Immediately expire the previous secret (manual cutoff). */
  @Post('expire-previous')
  @HttpCode(200)
  expirePrevious() {
    this.webhookService.expirePrevious();
    void this.auditService.record({
      action: AuditableAction.WEBHOOK_SECRET_EXPIRED_PREVIOUS,
      actorType: 'system',
      metadata: { expiredPrevious: true },
    });
    return { expired: true };
  }
}
