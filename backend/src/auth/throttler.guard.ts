import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard as NestThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ThrottlerGuard extends NestThrottlerGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ url?: string }>();
    const url = request.url ?? '';

    // Exclude health check routes from rate limiting
    if (url === '/health' || url.startsWith('/health/')) {
      return true;
    }

    return super.canActivate(context);
  }
}
