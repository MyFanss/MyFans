import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { WalletAuthService } from './wallet-auth.service';
import { RequestChallengeDto, VerifyChallengeDto } from './wallet-auth.dto';
import { Deprecated, DeprecationInterceptor } from '../common/deprecation';
import { PublicGuard } from '../auth-module/guards/public.guard';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { AuthExceptionFilter } from './filters/auth-exception.filter';
import { LoginBodyDto } from './dto/login-body.dto';
import {
  AuthErrorResponseDto,
  ChallengeResponseDto,
  SessionResponseDto,
  TokenResponseDto,
} from './dto/auth-responses.dto';

const X_NETWORK_HEADER = {
  name: 'x-network',
  required: false,
  description:
    'Stellar network identifier (mainnet | testnet). When provided it must match the server network; mismatches are rejected with 400.',
  schema: { type: 'string', example: 'testnet' },
} as const;

@ApiTags('auth')
@UseFilters(new AuthExceptionFilter())
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  private readonly serverNetwork = process.env.STELLAR_NETWORK ?? 'testnet';

  constructor(
    private readonly authService: AuthService,
    private readonly walletAuthService: WalletAuthService,
  ) {}

  private assertNetworkMatch(requestNetwork: string | undefined): void {
    if (!requestNetwork) return;
    const normalised = requestNetwork.trim().toLowerCase();
    if (normalised !== this.serverNetwork.toLowerCase()) {
      throw new HttpException(
        {
          error: 'NETWORK_MISMATCH',
          message: 'Wallet network does not match server network',
          expectedNetwork: this.serverNetwork,
          currentNetwork: requestNetwork,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('login')
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Authenticate with a Stellar wallet address' })
  @ApiHeader(X_NETWORK_HEADER)
  @ApiBody({ type: LoginBodyDto })
  @ApiResponse({ status: 201, description: 'Session created', type: SessionResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid Stellar address or network mismatch', type: AuthErrorResponseDto })
  @ApiResponse({ status: 429, description: 'Too many requests', type: AuthErrorResponseDto })
  async login(
    @Body() body: { address?: string },
    @Headers('x-network') requestNetwork?: string,
  ) {
    this.assertNetworkMatch(requestNetwork);
    const address = body.address ?? '';
    if (!this.authService.validateStellarAddress(address)) {
      throw new BadRequestException('Invalid Stellar address');
    }
    return this.authService.createSession(body.address!);
  }

  @Post('register')
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @Deprecated({
    sunset: '2026-01-01',
    link: '/v1/auth/login',
    message: 'Use POST /v1/auth/login instead. Removal date: 2026-01-01.',
  })
  @UseInterceptors(new DeprecationInterceptor(new Reflector()))
  @ApiOperation({ summary: '[Deprecated] Register with a Stellar wallet address', deprecated: true })
  @ApiHeader(X_NETWORK_HEADER)
  @ApiBody({ type: LoginBodyDto })
  @ApiResponse({ status: 201, description: 'Session created', type: SessionResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid Stellar address or network mismatch', type: AuthErrorResponseDto })
  @ApiResponse({ status: 429, description: 'Too many requests', type: AuthErrorResponseDto })
  async register(
    @Body() body: { address?: string },
    @Headers('x-network') requestNetwork?: string,
  ) {
    this.assertNetworkMatch(requestNetwork);
    const address = body.address ?? '';
    if (!this.authService.validateStellarAddress(address)) {
      throw new BadRequestException('Invalid Stellar address');
    }
    return this.authService.createSession(body.address!);
  }

  @Post('challenge')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Request a sign-in challenge for a Stellar wallet',
    description: 'Returns a one-time nonce the wallet must sign. The challenge expires after 5 minutes.',
  })
  @ApiHeader(X_NETWORK_HEADER)
  @ApiResponse({ status: 200, description: 'Nonce and expiry returned', type: ChallengeResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid Stellar address or network mismatch', type: AuthErrorResponseDto })
  @ApiResponse({ status: 429, description: 'Too many requests', type: AuthErrorResponseDto })
  async requestChallenge(
    @Body() dto: RequestChallengeDto,
    @Headers('x-network') requestNetwork?: string,
  ) {
    this.assertNetworkMatch(requestNetwork);
    if (!this.authService.validateStellarAddress(dto.address)) {
      throw new BadRequestException('Invalid Stellar address');
    }
    return this.walletAuthService.createChallenge(dto.address);
  }

  @Post('challenge/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Verify wallet signature and receive JWT',
    description: 'Validates the Ed25519 signature against the previously issued nonce and returns a Bearer token on success.',
  })
  @ApiHeader(X_NETWORK_HEADER)
  @ApiResponse({ status: 200, description: 'JWT access token', type: TokenResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid Stellar address or signature', type: AuthErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Expired or replayed challenge', type: AuthErrorResponseDto })
  @ApiResponse({ status: 429, description: 'Too many requests', type: AuthErrorResponseDto })
  async verifyChallenge(
    @Body() dto: VerifyChallengeDto,
    @Headers('x-network') requestNetwork?: string,
  ) {
    this.assertNetworkMatch(requestNetwork);
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
