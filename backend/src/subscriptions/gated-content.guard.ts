import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { CREATOR_KEY } from './decorators/requires-subscription.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionCacheService } from './subscription-cache.service';
import { SubscriptionChainReaderService } from './subscription-chain-reader.service';
import { isStellarAccountAddress } from '../common/utils/stellar-address';

@Injectable()
export class GatedContentGuard implements CanActivate {
  private readonly logger = new Logger(GatedContentGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly cache: SubscriptionCacheService,
    private readonly chainReader: SubscriptionChainReaderService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const creatorMeta = this.reflector.getAllAndOverride<string | undefined>(
      CREATOR_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Route not gated — allow through
    if (!creatorMeta) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: any }>();

    // ── 1. Resolve fan address from JWT ──────────────────────────────────
    const fan = this.extractFan(req);
    if (!fan) throw new UnauthorizedException('Authentication required');

    // ── 2. Resolve creator address (literal or route param) ───────────────
    const creatorParam = creatorMeta.startsWith(':')
      ? req.params[creatorMeta.slice(1)]
      : creatorMeta;
    const creator = Array.isArray(creatorParam) ? creatorParam[0] : (creatorParam ?? '');

    if (!isStellarAccountAddress(creator)) {
      throw new ForbiddenException('Invalid creator address');
    }

    // ── 3. Cache hit (positive only) ──────────────────────────────────────
    if (this.cache.get(fan, creator)) return true;

    // ── 4. Indexed DB check ───────────────────────────────────────────────
    const indexed = await this.subscriptionsService.isSubscriber(fan, creator);
    if (indexed) {
      this.cache.set(fan, creator);
      return true;
    }

    // ── 5. Chain fallback ─────────────────────────────────────────────────
    const contractId = this.chainReader.getConfiguredContractId();
    if (contractId) {
      try {
        const result = await this.chainReader.readIsSubscriber(contractId, fan, creator);
        if (result.ok && result.isSubscriber) {
          this.cache.set(fan, creator);
          return true;
        }
        if (!result.ok) {
          // RPC failure — log and deny (fail-closed)
          this.logger.warn(
            `Chain fallback failed for ${fan}->${creator}: ${result.error}. Denying access.`,
          );
        }
      } catch (err) {
        this.logger.error('Unexpected chain read error', err);
      }
    }

    throw new ForbiddenException('Active subscription required');
  }

  private extractFan(req: Request & { user?: any }): string | null {
    // Prefer already-decoded JWT user (set by JwtAuthGuard upstream)
    if (req.user?.sub && isStellarAccountAddress(req.user.sub)) {
      return req.user.sub;
    }

    // Decode JWT ourselves if guard runs standalone
    const header = req.headers['authorization'];
    const token = typeof header === 'string' && header.startsWith('Bearer ')
      ? header.slice(7)
      : null;

    if (!token) return null;

    try {
      const payload = this.jwtService.verify<{ sub: string }>(token);
      return isStellarAccountAddress(payload.sub) ? payload.sub : null;
    } catch {
      return null;
    }
  }
}
