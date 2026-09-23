import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { Public } from './decorators/public.decorator';
import { ChallengeDto, VerifyChallengeDto } from './dto/challenge.dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('challenge')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Issue a Stellar challenge message bound to pubkey + nonce + TTL',
  })
  @ApiBody({ type: ChallengeDto })
  @ApiResponse({ status: 200, description: 'Challenge message and expiry' })
  @ApiResponse({ status: 429, description: 'Too many challenge requests' })
  async challenge(@Body() dto: ChallengeDto) {
    return this.authService.issueChallenge(dto.pubkey);
  }

  @Post('verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Verify a signed challenge and issue a JWT (sub=pubkey, role)',
  })
  @ApiBody({ type: VerifyChallengeDto })
  @ApiResponse({ status: 200, description: 'Access token and role' })
  @ApiResponse({ status: 401, description: 'Invalid or expired challenge' })
  @ApiResponse({ status: 429, description: 'Too many verification attempts' })
  async verify(
    @Body() dto: VerifyChallengeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyChallenge(
      dto.pubkey,
      dto.signature,
    );

    // Double-submit CSRF cookie for browser SPA sessions. Native/mobile
    // clients authenticate with Bearer tokens only and are exempt from the
    // CSRF header requirement (see docs/CSRF_MOBILE_SPA.md).
    const csrfToken = this.authService.issueCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      domain: process.env.COOKIE_DOMAIN || undefined,
      path: '/',
      maxAge: CSRF_COOKIE_MAX_AGE_MS,
    });

    return { ...result, csrfToken };
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Request() req: any) {
    return this.authService.findById(req.user.userId);
  }

  @Get('users')
  @Roles('admin')
  @ApiOperation({ summary: 'List users (paginated, admin only)' })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Pagination cursor (nextCursor from previous page)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page (default 20, max 100)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (1-based, default 1)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of users',
    type: PaginatedResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getUsers(
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<any>> {
    return this.authService.findAllUsers(pagination);
  }
}
