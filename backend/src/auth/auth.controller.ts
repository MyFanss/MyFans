import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Deprecated, DeprecationInterceptor } from '../common/deprecation';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  async login(@Body() body: { address?: string }) {
    const address = body.address ?? '';
    if (!this.authService.validateStellarAddress(address)) {
      throw new BadRequestException('Invalid Stellar address');
    }
    return this.authService.createSession(address);
  }

  @Post('register')
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @Deprecated({
    sunset: '2026-01-01',
    link: '/v1/auth/login',
    message: 'Use POST /v1/auth/login instead. Removal date: 2026-01-01.',
  })
  @UseInterceptors(new DeprecationInterceptor(new Reflector()))
  async register(@Body() body: { address?: string }) {
    const address = body.address ?? '';
    if (!this.authService.validateStellarAddress(address)) {
      throw new BadRequestException('Invalid Stellar address');
    }
    return this.authService.createSession(address);
  }
}
