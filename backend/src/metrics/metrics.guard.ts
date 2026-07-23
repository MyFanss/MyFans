import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class MetricsGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers.authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('Missing authorization token');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException('Invalid authorization header format');
    }

    const token = parts[1];
    const expectedToken = this.configService.get<string>('METRICS_SCRAPE_TOKEN');

    if (!expectedToken) {
      throw new UnauthorizedException('Metrics scrape token not configured');
    }

    if (token !== expectedToken) {
      throw new UnauthorizedException('Invalid scrape token');
    }

    return true;
  }
}
