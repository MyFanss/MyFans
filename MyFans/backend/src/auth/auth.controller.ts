import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  async login(@Body() body: { address?: string }) {
    if (!this.authService.validateStellarAddress(body?.address ?? '')) {
      throw new BadRequestException('Invalid Stellar address');
    }
    return this.authService.createSession(address);
  }

  @Post('register')
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  async register(@Body() body: { address?: string }) {
    if (!this.authService.validateStellarAddress(body?.address ?? '')) {
      throw new BadRequestException('Invalid Stellar address');
    }
    return this.authService.createSession(address);
  }
}
