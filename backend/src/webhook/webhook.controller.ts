import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WebhookGuard } from './webhook.guard';
import { WebhookService } from './webhook.service';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { RolesGuard } from '../auth-module/guards/roles.guard';
import { Roles } from '../auth-module/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('webhook')
@Controller({ path: 'webhook', version: '1' })
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly auditService: WebhookAuditService,
    private readonly processorService: WebhookEventProcessorService,
  ) {}

  /**
   * Receive an incoming signed webhook event.
   * Authenticated by the payload signature (WebhookGuard), not by a JWT.
   */
  @Post()
  @Public()
  @HttpCode(200)
  @UseGuards(WebhookGuard)
  @ApiOperation({ summary: 'Receive a signed webhook event' })
  @ApiResponse({ status: 200, description: 'Event received and queued for processing' })
  @ApiResponse({ status: 401, description: 'Invalid webhook signature' })
  async receive(@Body() body: unknown) {
    const result = await this.processorService.processEvent(body);
    return {
      received: true,
      ...result,
    };
  }

  /**
   * Rotate the active signing secret. Admin-only.
   * Body: { newSecret: string; cutoffMs?: number }
   */
  @Post('rotate')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Rotate the webhook signing secret' })
  @ApiResponse({ status: 200, description: 'Secret rotated' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Caller is not an admin' })
  rotate(@Body() body: { newSecret: string; cutoffMs?: number }) {
    this.webhookService.rotate(body.newSecret, body.cutoffMs);
    await this.auditService.logRotation(user.id, body.cutoffMs);
    const state = this.webhookService.getState();
    return {
      rotated: true,
      cutoffAt: state.cutoffAt,
      hasPrevious: !!state.previous,
    };
  }

  /** Immediately expire the previous secret (manual cutoff). Admin-only. */
  @Post('expire-previous')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[Admin] Expire the previous webhook signing secret',
  })
  @ApiResponse({ status: 200, description: 'Previous secret expired' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Caller is not an admin' })
  expirePrevious() {
    this.webhookService.expirePrevious();
    await this.auditService.logExpirePrevious(user.id);
    return { expired: true };
  }
}
