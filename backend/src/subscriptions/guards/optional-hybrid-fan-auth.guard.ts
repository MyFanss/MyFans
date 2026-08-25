import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { HybridFanAuthGuard } from './hybrid-fan-auth.guard';

/**
 * Like {@link HybridFanAuthGuard} but never rejects the request: a valid
 * Stellar bearer token or platform JWT populates `req.fanAddress` /
 * `req.user` (+ `req.authMode`) as usual, while a missing or invalid
 * credential just leaves the request unauthenticated instead of throwing.
 *
 * Use on routes that vary their response for authenticated vs. anonymous
 * callers without requiring auth (e.g. gated-content teasers, #1562).
 */
@Injectable()
export class OptionalHybridFanAuthGuard implements CanActivate {
  constructor(private readonly hybridGuard: HybridFanAuthGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await this.hybridGuard.canActivate(context);
    } catch {
      // No/invalid credentials — proceed unauthenticated, matching
      // OptionalJwtAuthGuard's contract.
    }
    return true;
  }
}
