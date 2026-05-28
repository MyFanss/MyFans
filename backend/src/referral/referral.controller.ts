import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ReferralService } from './referral.service';
import { CreateReferralCodeDto } from './dto/create-referral-code.dto';
import { RedeemReferralCodeDto } from './dto/redeem-referral-code.dto';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { CurrentUser } from '../auth-module/decorators/current-user.decorator';

@ApiTags('referral')
@Controller({ path: 'referral', version: '1' })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  /** POST /v1/referral/codes — generate a new code for the authenticated user */
  @Post('codes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate a referral / invite code' })
  @ApiResponse({ status: 201, description: 'Code created' })
  createCode(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateReferralCodeDto,
  ) {
    return this.referralService.createCode(user.id, dto);
  }

  /** GET /v1/referral/codes — list my codes */
  @Get('codes')
  @ApiOperation({ summary: 'List my referral codes' })
  @ApiResponse({ status: 200, description: 'List of codes' })
  listCodes(@CurrentUser() user: { id: string }) {
    return this.referralService.listCodes(user.id);
  }

  /** PATCH /v1/referral/codes/:id/deactivate — deactivate a code */
  @Patch('codes/:id/deactivate')
  @ApiOperation({ summary: 'Deactivate a referral code' })
  @ApiParam({ name: 'id', description: 'Referral code UUID' })
  @ApiResponse({ status: 200, description: 'Code deactivated' })
  @ApiResponse({ status: 403, description: 'Not your code' })
  @ApiResponse({ status: 404, description: 'Code not found' })
  deactivateCode(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.referralService.deactivateCode(user.id, id);
  }

  /** GET /v1/referral/codes/:id/redemptions — list redemptions for a code */
  @Get('codes/:id/redemptions')
  @ApiOperation({ summary: 'List redemptions for a referral code' })
  @ApiParam({ name: 'id', description: 'Referral code UUID' })
  @ApiResponse({ status: 200, description: 'List of redemptions' })
  listRedemptions(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.referralService.listRedemptions(user.id, id);
  }

  /** POST /v1/referral/validate — validate a code without redeeming */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a referral code (no redemption)' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  validateCode(@Body() dto: RedeemReferralCodeDto) {
    return this.referralService.validateCode(dto.code);
  }

  /** POST /v1/referral/redeem — redeem a code */
  @Post('redeem')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Redeem a referral / invite code' })
  @ApiResponse({ status: 201, description: 'Code redeemed' })
  @ApiResponse({ status: 400, description: 'Invalid or exhausted code' })
  @ApiResponse({ status: 409, description: 'Already redeemed' })
  redeemCode(
    @CurrentUser() user: { id: string },
    @Body() dto: RedeemReferralCodeDto,
  ) {
    return this.referralService.redeemCode(user.id, dto);
  }
}
