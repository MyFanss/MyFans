import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Protects audit query endpoints. Set `AUDIT_ADMIN_API_KEY` in the environment.
 */
@Injectable()
export class AuditAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.AUDIT_ADMIN_API_KEY?.trim();
    if (!expected) {
      throw new ServiceUnavailableException(
        'Audit query is disabled (AUDIT_ADMIN_API_KEY not configured)',
      );
    }
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers['x-admin-audit-key'];
    if (typeof provided !== 'string' || provided !== expected) {
      throw new UnauthorizedException('Invalid audit admin API key');
    }
    return true;
  }
}
