import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RefreshTokenService, TokenPair } from './refresh-token.service';
import { RefreshTokenDto, LogoutDto, TokenResponseDto } from './refresh-token.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly refreshTokenService: RefreshTokenService) { }

  /**
   * POST /auth/refresh
   * Exchange a valid refresh token for a new access + refresh token pair.
   * The old refresh token is invalidated (rotation).
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using a refresh token' })
  @ApiResponse({ status: 200, type: TokenResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<TokenResponseDto> {
    const { access_token, refresh_token, token_type, expires_in } =
      await this.refreshTokenService.rotate(dto.refresh_token);

    return { access_token, refresh_token, token_type, expires_in };
  }

  /**
   * POST /auth/logout
   * Invalidate the provided refresh token.
   * Pass all_devices: true to log out from every session.
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invalidate refresh token (logout)' })
  @ApiResponse({ status: 204, description: 'Logged out successfully' })
  async logout(@Body() dto: LogoutDto, @Request() req: any): Promise<void> {
    if (dto.all_devices) {
      await this.refreshTokenService.invalidateAll(req.user.userId);
    } else {
      await this.refreshTokenService.invalidate(dto.refresh_token);
    }
  }
}
