import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Deprecated } from '../common/deprecation';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @Deprecated({
    sunsetDate: '2026-01-01',
    migrationPath: '/auth/refresh',
    reason: 'Use POST /auth/refresh with JWT refresh tokens. Stellar-key session login is deprecated.',
  })
  async login(@Body() body: { address: string }) {
    if (!this.authService.validateStellarAddress(body.address)) {
      return { error: 'Invalid Stellar address' };
    }
    return this.authService.createSession(body.address);
  }
}
