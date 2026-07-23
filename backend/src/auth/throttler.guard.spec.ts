import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from './throttler.guard';
import {
  ThrottlerModule,
  ThrottlerGuard as NestThrottlerGuard,
} from '@nestjs/throttler';

describe('ThrottlerGuard', () => {
  let guard: ThrottlerGuard;

  const mockExecutionContext = (
    url: string,
    method: string = 'GET',
  ): ExecutionContext => {
    const mockRequest = {
      url,
      method,
      headers: {},
      ip: '127.0.0.1',
    };
    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
      getHandler: () => () => {},
      getClass: () => () => {},
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          { name: 'short', ttl: 60000, limit: 10 },
          { name: 'medium', ttl: 60000, limit: 50 },
          { name: 'long', ttl: 60000, limit: 100 },
        ]),
      ],
      providers: [ThrottlerGuard],
    }).compile();

    // init() (not just compile()) so the base guard's onModuleInit runs and
    // populates its throttler config.
    await module.init();

    guard = module.get<ThrottlerGuard>(ThrottlerGuard);
  });

  describe('Health Check Exemption', () => {
    // Only the cheap liveness probe is exempt. The expensive sub-checks are
    // deliberately throttled so scanning probes cannot exhaust resources.
    let superCanActivate: jest.SpyInstance;

    beforeEach(() => {
      superCanActivate = jest
        .spyOn(NestThrottlerGuard.prototype, 'canActivate')
        .mockResolvedValue(true);
    });

    afterEach(() => {
      superCanActivate.mockRestore();
    });

    it.each(['/health', '/v1/health'])(
      'exempts %s without consulting the throttler',
      async (url) => {
        await expect(
          guard.canActivate(mockExecutionContext(url)),
        ).resolves.toBe(true);
        expect(superCanActivate).not.toHaveBeenCalled();
      },
    );

    it.each([
      '/health/db',
      '/v1/health/db',
      '/health/redis',
      '/v1/health/soroban',
      '/health/queue-metrics',
      '/v1/health/queue-metrics',
      '/v1/health/soroban-contract',
    ])('throttles %s like any other route', async (url) => {
      await guard.canActivate(mockExecutionContext(url));
      expect(superCanActivate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Guard Interface', () => {
    it('should implement CanActivate interface', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(guard.canActivate).toBeDefined();
      expect(typeof guard.canActivate).toBe('function');
    });

    it('should be injectable', () => {
      expect(guard).toBeDefined();
      expect(typeof guard.canActivate).toBe('function');
    });

    it('should be decorated with @Injectable', () => {
      expect(guard.constructor).toBeDefined();
    });
  });
});
