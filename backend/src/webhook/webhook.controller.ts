import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WebhookGuard } from './webhook.guard';
import { WebhookService } from './webhook.service';

@ApiTags('webhook')
@Controller({ path: 'webhook', version: '1' })
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  /** Receive an incoming signed webhook event. */
  @Post()
  @HttpCode(200)
  @UseGuards(WebhookGuard)
  @ApiOperation({ summary: 'Receive a signed webhook event' })
  @ApiResponse({ status: 200, description: 'Event received' })
  @ApiResponse({ status: 401, description: 'Invalid webhook signature' })
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
  @ApiOperation({ summary: '[Admin] Rotate the webhook signing secret' })
  @ApiResponse({ status: 200, description: 'Secret rotated' })
  rotate(@Body() body: { newSecret: string; cutoffMs?: number }) {
    this.webhookService.rotate(body.newSecret, body.cutoffMs);
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
  @ApiOperation({ summary: '[Admin] Expire the previous webhook signing secret' })
  @ApiResponse({ status: 200, description: 'Previous secret expired' })
  expirePrevious() {
    this.webhookService.expirePrevious();
    return { expired: true };
  }
}
