import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard as NestThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ThrottlerGuard extends NestThrottlerGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ url?: string; method?: string }>();
    const url = request.url ?? '';

    if (this.isHealthCheckRoute(url)) {
      return true;
    }

    return super.canActivate(context);
  }

  private isHealthCheckRoute(url: string): boolean {
    return (
      url === '/health' ||
      url.startsWith('/health/') ||
      url.startsWith('/v1/health')
    );
  }
}
