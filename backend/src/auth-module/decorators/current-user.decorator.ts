import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/** Canonical shape of req.user set by JwtStrategy.validate() */
export interface JwtUserPayload {
  userId: string;
  email: string;
  role?: string;
  /** Stellar public key (G...) that identifies the user; no temp IDs. */
  stellarPubkey?: string;
}

/**
 * Resolves the authenticated user from the request.
 *
 * Mutating routes must be keyed by the Stellar pubkey identity rather than a
 * temporary user id. When `requirePubkey` is set, the decorator rejects the
 * request if no pubkey is present so authz can never fall back to a temp id.
 */
export const CurrentUser = createParamDecorator(
  (requirePubkey: boolean, ctx: ExecutionContext): JwtUserPayload => {
    const request = ctx.switchToHttp().getRequest();
    const user: JwtUserPayload | undefined = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (requirePubkey && !user.stellarPubkey) {
      throw new UnauthorizedException(
        'Stellar public key required for this operation',
      );
    }

    return user;
  },
);
