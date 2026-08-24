import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard as NestThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ThrottlerGuard extends NestThrottlerGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ url?: string; method?: string }>();
    const url = request.url ?? '';

    if (url === '/health' || url === '/v1/health') {
      return true;
    }

    return super.canActivate(context);
  }
}
