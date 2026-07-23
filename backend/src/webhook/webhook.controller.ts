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
import { WebhookAuditService } from './webhook-audit.service';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { RolesGuard } from '../auth-module/guards/roles.guard';
import { Roles } from '../auth-module/decorators/roles.decorator';
import { CurrentUser } from '../auth-module/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('webhook')
@Controller({ path: 'webhook', version: '1' })
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly auditService: WebhookAuditService,
  ) {}

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
   * Rotate the active signing secret (admin only).
   * Body: { newSecret: string; cutoffMs?: number }
   */
  @Post('rotate')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Rotate the webhook signing secret' })
  @ApiResponse({ status: 200, description: 'Secret rotated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  async rotate(
    @Body() body: { newSecret: string; cutoffMs?: number },
    @CurrentUser() user: { id: string },
  ) {
    this.webhookService.rotate(body.newSecret, body.cutoffMs);
    await this.auditService.logRotation(user.id, body.cutoffMs);
    const state = this.webhookService.getState();
    return {
      rotated: true,
      cutoffAt: state.cutoffAt,
      hasPrevious: !!state.previous,
    };
  }

  /** Immediately expire the previous secret (admin only). */
  @Post('expire-previous')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Expire the previous webhook signing secret' })
  @ApiResponse({ status: 200, description: 'Previous secret expired' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  async expirePrevious(@CurrentUser() user: { id: string }) {
    this.webhookService.expirePrevious();
    await this.auditService.logExpirePrevious(user.id);
    return { expired: true };
  }
}
