import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class CreatorAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { creator?: { id: string } }>();
    const creator = req.creator;
    if (!creator || !creator.id) {
      throw new UnauthorizedException('Creator authentication required');
    }
    return true;
  }
}
