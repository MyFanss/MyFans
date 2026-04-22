import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { isStellarAccountAddress } from '../../common/utils/stellar-address';

export type RequestWithFan = Request & { fanAddress: string };

/**
 * Expects `Authorization: Bearer <token>` where token is base64(utf8 Stellar G-address),
 * matching {@link AuthService#createSession} in `src/auth/auth.service.ts`.
 */
@Injectable()
export class FanBearerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithFan>();
    const raw = req.headers['authorization'] ?? req.headers['Authorization'];
    const header = Array.isArray(raw) ? raw[0] : raw;
    if (!header || typeof header !== 'string') {
      throw new UnauthorizedException(
        'Missing Authorization header. Use: Authorization: Bearer <base64(Stellar G-address)> (same token as /v1/auth/login).',
      );
    }
    const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
    if (!m) {
      throw new UnauthorizedException(
        'Authorization must be Bearer token (base64-encoded Stellar account address).',
      );
    }
    let address: string;
    try {
      address = Buffer.from(m[1], 'base64').toString('utf8').trim();
    } catch {
      throw new UnauthorizedException('Bearer token is not valid base64.');
    }
    if (!isStellarAccountAddress(address)) {
      throw new UnauthorizedException(
        'Decoded Bearer token is not a valid Stellar account address (expected G… 56 chars).',
      );
    }
    req.fanAddress = address;
    return true;
  }
}
