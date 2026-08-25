import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ThrottlerGuard as NestThrottlerGuard,
  ThrottlerModule,
} from '@nestjs/throttler';
import { ThrottlerGuard } from './throttler.guard';

describe('ThrottlerGuard', () => {
  let guard: ThrottlerGuard;

  const context = (url: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          url,
          method: 'GET',
          headers: {},
          ip: '127.0.0.1',
        }),
      }),
      getHandler: () => () => undefined,
      getClass: () => () => undefined,
    }) as unknown as ExecutionContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          { name: 'short', ttl: 60_000, limit: 10 },
          { name: 'medium', ttl: 60_000, limit: 50 },
          { name: 'long', ttl: 60_000, limit: 100 },
        ]),
      ],
      providers: [ThrottlerGuard],
    }).compile();
    await module.init();
    guard = module.get(ThrottlerGuard);
  });

  it.each(['/health', '/v1/health'])('exempts %s', async (url) => {
    const baseGuard = jest.spyOn(NestThrottlerGuard.prototype, 'canActivate');
    await expect(guard.canActivate(context(url))).resolves.toBe(true);
    expect(baseGuard).not.toHaveBeenCalled();
    baseGuard.mockRestore();
  });

  it.each(['/health/db', '/v1/health/redis'])('throttles %s', async (url) => {
    const baseGuard = jest
      .spyOn(NestThrottlerGuard.prototype, 'canActivate')
      .mockResolvedValue(true);
    await guard.canActivate(context(url));
    expect(baseGuard).toHaveBeenCalledTimes(1);
    baseGuard.mockRestore();
  });
});
