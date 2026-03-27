import {
  Controller,
  Post,
  Body,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { WalletAuthService } from './wallet-auth.service';
import { RequestChallengeDto, VerifyChallengeDto } from './wallet-auth.dto';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly walletAuthService: WalletAuthService,
  ) {}

  @Post('login')
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  async login(@Body() body: { address?: string }) {
    if (!this.authService.validateStellarAddress(body?.address ?? '')) {
      throw new BadRequestException('Invalid Stellar address');
    }
    return this.authService.createSession(body.address!);
  }

  @Post('register')
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  async register(@Body() body: { address?: string }) {
    if (!this.authService.validateStellarAddress(body?.address ?? '')) {
      throw new BadRequestException('Invalid Stellar address');
    }
    return this.authService.createSession(body.address!);
  }

  /**
   * POST /v1/auth/challenge
   * Returns a one-time nonce the wallet must sign.
   */
  @Post('challenge')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Request a sign-in challenge for a Stellar wallet' })
  @ApiResponse({ status: 200, description: 'Nonce and expiry returned' })
  async requestChallenge(@Body() dto: RequestChallengeDto) {
    if (!this.authService.validateStellarAddress(dto.address)) {
      throw new BadRequestException('Invalid Stellar address');
    }
    return this.walletAuthService.createChallenge(dto.address);
  }

  /**
   * POST /v1/auth/challenge/verify
   * Verifies the signed nonce and issues a JWT on success.
   */
  @Post('challenge/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify wallet signature and receive JWT' })
  @ApiResponse({ status: 200, description: 'JWT access token' })
  @ApiResponse({ status: 400, description: 'Invalid signature' })
  @ApiResponse({ status: 401, description: 'Expired or replayed challenge' })
  async verifyChallenge(@Body() dto: VerifyChallengeDto) {
    if (!this.authService.validateStellarAddress(dto.address)) {
      throw new BadRequestException('Invalid Stellar address');
    }
    return this.walletAuthService.verifyAndIssueToken(
      dto.address,
      dto.nonce,
      dto.signature,
    );
  }
}
