import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { GatedContentGuard } from './gated-content.guard';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionCacheService } from './subscription-cache.service';
import { SubscriptionChainReaderService } from './subscription-chain-reader.service';
import { CREATOR_KEY } from './decorators/requires-subscription.decorator';

const FAN = 'GFAN1111111111111111111111111111111111111111111111111111';
const CREATOR = 'GCREATOR111111111111111111111111111111111111111111111111';
const JWT_TOKEN = 'valid.jwt.token';

function makeContext(overrides: {
  creatorMeta?: string;
  user?: any;
  authHeader?: string;
  params?: Record<string, string>;
}): ExecutionContext {
  const req: any = {
    user: overrides.user,
    headers: overrides.authHeader ? { authorization: overrides.authHeader } : {},
    params: overrides.params ?? {},
  };
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('GatedContentGuard', () => {
  let guard: GatedContentGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let jwtService: { verify: jest.Mock };
  let subscriptionsService: { isSubscriber: jest.Mock };
  let cache: SubscriptionCacheService;
  let chainReader: { getConfiguredContractId: jest.Mock; readIsSubscriber: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    jwtService = { verify: jest.fn() };
    subscriptionsService = { isSubscriber: jest.fn() };
    cache = new SubscriptionCacheService();
    chainReader = {
      getConfiguredContractId: jest.fn().mockReturnValue(undefined),
      readIsSubscriber: jest.fn(),
    };

    guard = new GatedContentGuard(
      reflector as unknown as Reflector,
      jwtService as unknown as JwtService,
      subscriptionsService as unknown as SubscriptionsService,
      cache,
      chainReader as unknown as SubscriptionChainReaderService,
    );
  });

  it('allows through when route is not gated', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('throws UnauthorizedException when no token provided', async () => {
    reflector.getAllAndOverride.mockReturnValue(CREATOR);
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows subscriber via cache hit (no DB/chain call)', async () => {
    reflector.getAllAndOverride.mockReturnValue(CREATOR);
    cache.set(FAN, CREATOR);
    const ctx = makeContext({ user: { sub: FAN } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(subscriptionsService.isSubscriber).not.toHaveBeenCalled();
  });

  it('allows subscriber via indexed DB and populates cache', async () => {
    reflector.getAllAndOverride.mockReturnValue(CREATOR);
    subscriptionsService.isSubscriber.mockReturnValue(true);
    const ctx = makeContext({ user: { sub: FAN } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(cache.get(FAN, CREATOR)).toBe(true);
  });

  it('allows subscriber via chain fallback when DB returns false', async () => {
    reflector.getAllAndOverride.mockReturnValue(CREATOR);
    subscriptionsService.isSubscriber.mockReturnValue(false);
    chainReader.getConfiguredContractId.mockReturnValue('CONTRACT_ID');
    chainReader.readIsSubscriber.mockResolvedValue({ ok: true, isSubscriber: true });
    const ctx = makeContext({ user: { sub: FAN } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(cache.get(FAN, CREATOR)).toBe(true);
  });

  it('denies non-subscriber when DB=false and chain=false', async () => {
    reflector.getAllAndOverride.mockReturnValue(CREATOR);
    subscriptionsService.isSubscriber.mockReturnValue(false);
    chainReader.getConfiguredContractId.mockReturnValue('CONTRACT_ID');
    chainReader.readIsSubscriber.mockResolvedValue({ ok: true, isSubscriber: false });
    const ctx = makeContext({ user: { sub: FAN } });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies (fail-closed) when chain RPC fails', async () => {
    reflector.getAllAndOverride.mockReturnValue(CREATOR);
    subscriptionsService.isSubscriber.mockReturnValue(false);
    chainReader.getConfiguredContractId.mockReturnValue('CONTRACT_ID');
    chainReader.readIsSubscriber.mockResolvedValue({ ok: false, error: 'timeout' });
    const ctx = makeContext({ user: { sub: FAN } });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('resolves creator from route param when meta starts with ":"', async () => {
    reflector.getAllAndOverride.mockReturnValue(':creatorId');
    subscriptionsService.isSubscriber.mockReturnValue(true);
    const ctx = makeContext({ user: { sub: FAN }, params: { creatorId: CREATOR } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('extracts fan from JWT header when req.user is absent', async () => {
    reflector.getAllAndOverride.mockReturnValue(CREATOR);
    jwtService.verify.mockReturnValue({ sub: FAN });
    subscriptionsService.isSubscriber.mockReturnValue(true);
    const ctx = makeContext({ authHeader: `Bearer ${JWT_TOKEN}` });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
