import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { address: string }) {
    if (!this.authService.validateStellarAddress(body.address)) {
      return { error: 'Invalid Stellar address' };
    }
    return this.authService.createSession(body.address);
  }
}
