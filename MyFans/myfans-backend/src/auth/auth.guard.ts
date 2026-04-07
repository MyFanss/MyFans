import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Auth guard - extracts user from X-User-Id header (dev) or Authorization Bearer.
 * For production, replace with JWT validation. X-User-Id should be the user's UUID.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const rawUserId = request.headers['x-user-id'];
    const headerUserId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
    const userId =
      headerUserId ??
      this.extractUserIdFromBearer(request.headers.authorization);

    if (!userId || typeof userId !== 'string') {
      throw new UnauthorizedException('Authentication required');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    (request as any).user = user;
    return true;
  }

  private extractUserIdFromBearer(auth?: string): string | undefined {
    if (!auth?.startsWith('Bearer ')) return undefined;
    return auth.slice(7).trim();
  }
}
