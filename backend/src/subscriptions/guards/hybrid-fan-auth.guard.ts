import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { isStellarAccountAddress } from '../../common/utils/stellar-address';

export type RequestWithHybridAuth = Request & {
  fanAddress?: string;
  user?: { userId: string; email?: string };
  authMode?: 'stellar-bearer' | 'jwt';
};

/**
 * This codebase currently has two independent auth modes with no stored
 * link between them:
 *
 *  - Stellar bearer ({@link FanBearerGuard}): `Authorization: Bearer
 *    base64(Stellar G-address)`, matching `AuthService#createSession` in
 *    `src/auth-module/auth.service.ts`. Used on subscription/fan routes. Resolves
 *    directly to a Stellar address (`req.fanAddress`); there is no platform
 *    user account behind it.
 *  - Passport JWT (`JwtAuthGuard` / `src/auth-module`): `Authorization:
 *    Bearer <JWT>` where `sub` is a platform user UUID, validated against
 *    `AuthService#validateUser`. Used on social routes (creators, posts,
 *    comments, conversations, ...).
 *
 * Since there is no `users` column or table linking a platform user UUID to
 * a Stellar wallet address, true identity *unification* isn't possible yet.
 * This guard implements the *bridge* option instead: it accepts either
 * credential type on the same endpoint and normalizes the result onto the
 * request, tagged with `authMode`, so a handler can tell which kind of
 * identity it received instead of assuming `fanAddress` is always present.
 *
 * Handlers that specifically require a resolved Stellar address (e.g.
 * subscription/chain checks) must still check `authMode === 'stellar-bearer'`
 * explicitly and reject (401/403) a `'jwt'`-mode caller — this guard only
 * authenticates the request, it does not fabricate a Stellar address for a
 * JWT-authenticated platform user.
 */
@Injectable()
export class HybridFanAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithHybridAuth>();
    const raw = req.headers['authorization'] ?? req.headers['Authorization'];
    const header = Array.isArray(raw) ? raw[0] : raw;

    if (!header || typeof header !== 'string') {
      throw new UnauthorizedException(
        'Missing Authorization header. Use either a Stellar bearer token ' +
          '(base64-encoded G-address) or a platform JWT.',
      );
    }

    const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
    if (!match) {
      throw new UnauthorizedException('Authorization must be a Bearer token.');
    }
    const token = match[1];

    const stellarAddress = this.tryDecodeStellarBearer(token);
    if (stellarAddress) {
      req.fanAddress = stellarAddress;
      req.authMode = 'stellar-bearer';
      return true;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email?: string;
      }>(token);
      req.user = { userId: payload.sub, email: payload.email };
      req.authMode = 'jwt';
      return true;
    } catch {
      throw new UnauthorizedException(
        'Bearer token is neither a valid Stellar bearer token nor a valid JWT.',
      );
    }
  }

  private tryDecodeStellarBearer(token: string): string | null {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf8').trim();
      return isStellarAccountAddress(decoded) ? decoded : null;
    } catch {
      return null;
    }
  }
}
