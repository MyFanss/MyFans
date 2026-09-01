import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OPENAPI_SECURITY_SCHEMES } from '../common/openapi.config';
import { HybridFanAuthGuard } from './guards/hybrid-fan-auth.guard';
import type { RequestWithHybridAuth } from './guards/hybrid-fan-auth.guard';
import { SpendingCapService } from './services/spending-cap.service';
import {
  SetSpendingCapDto,
  SpendingCapResponseDto,
} from './dto/spending-cap.dto';

/**
 * Accepts both a Stellar bearer token and a Passport JWT (see
 * {@link HybridFanAuthGuard}), but spending caps are keyed by Stellar
 * address, so a JWT-authenticated caller with no linked address is
 * rejected explicitly rather than silently operating on `undefined`.
 */
function requireFanAddress(req: RequestWithHybridAuth): string {
  if (req.authMode !== 'stellar-bearer' || !req.fanAddress) {
    throw new ForbiddenException(
      'This endpoint requires a Stellar bearer token; a platform JWT alone is not linked to a Stellar address.',
    );
  }
  return req.fanAddress;
}

@ApiTags('subscriptions')
@Controller({ path: 'subscriptions/me/spending-cap', version: '1' })
@UseGuards(HybridFanAuthGuard)
@ApiBearerAuth()
@ApiBearerAuth(OPENAPI_SECURITY_SCHEMES.jwt)
@ApiBearerAuth(OPENAPI_SECURITY_SCHEMES.fanBearer)
export class SpendingCapController {
  constructor(private readonly caps: SpendingCapService) {}

  @Get()
  @ApiOperation({ summary: "Get the authenticated fan's spending cap" })
  @ApiResponse({ status: 200, type: SpendingCapResponseDto })
  @ApiResponse({ status: 404, description: 'No cap set' })
  async getCap(
    @Req() req: RequestWithHybridAuth,
  ): Promise<SpendingCapResponseDto> {
    const cap = await this.caps.getCap(requireFanAddress(req));
    if (!cap) throw new NotFoundException('No spending cap configured');
    return cap;
  }

  @Put()
  @ApiOperation({
    summary: "Set or update the authenticated fan's spending cap",
  })
  @ApiResponse({ status: 200, type: SpendingCapResponseDto })
  async setCap(
    @Req() req: RequestWithHybridAuth,
    @Body() dto: SetSpendingCapDto,
  ): Promise<SpendingCapResponseDto> {
    return this.caps.setCap(requireFanAddress(req), dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove the authenticated fan's spending cap" })
  @ApiResponse({ status: 204, description: 'Cap removed' })
  async removeCap(@Req() req: RequestWithHybridAuth): Promise<void> {
    return this.caps.removeCap(requireFanAddress(req));
  }
}
