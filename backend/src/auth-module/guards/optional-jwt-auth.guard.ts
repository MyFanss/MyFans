import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Like {@link JwtAuthGuard} but never rejects the request: a valid bearer
 * token populates `req.user`, while a missing or invalid one just leaves it
 * undefined and the request proceeds unauthenticated.
 *
 * Use on routes that vary their response for authenticated vs. anonymous
 * callers without requiring auth (e.g. gated-content teasers).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // No/invalid token — proceed unauthenticated.
    }
    return true;
  }

  handleRequest(_err: unknown, user: unknown): unknown {
    // Never throw here (that's what makes auth "optional"); just pass
    // through whatever passport resolved, or undefined if it resolved none.
    return user || undefined;
  }
}
