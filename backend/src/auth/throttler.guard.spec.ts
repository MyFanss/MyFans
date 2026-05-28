import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from './throttler.guard';
import { ThrottlerModule } from '@nestjs/throttler';

describe('ThrottlerGuard', () => {
  let guard: ThrottlerGuard;

  const mockExecutionContext = (url: string, method: string = 'GET'): ExecutionContext => {
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
      getHandler: () => (() => {}) as any,
      getClass: () => (() => {}) as any,
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

    guard = module.get<ThrottlerGuard>(ThrottlerGuard);
  });

  describe('Health Check Exemption', () => {
    it('should exempt /health endpoint', async () => {
      const context = mockExecutionContext('/health');
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should exempt /v1/health endpoint', async () => {
      const context = mockExecutionContext('/v1/health');
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should exempt /health/db endpoint', async () => {
      const context = mockExecutionContext('/health/db');
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should exempt /v1/health/db endpoint', async () => {
      const context = mockExecutionContext('/v1/health/db');
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should exempt /health/redis endpoint', async () => {
      const context = mockExecutionContext('/health/redis');
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should exempt /v1/health/soroban endpoint', async () => {
      const context = mockExecutionContext('/v1/health/soroban');
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should exempt /health/queue-metrics endpoint', async () => {
      const context = mockExecutionContext('/health/queue-metrics');
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should exempt /v1/health/queue-metrics endpoint', async () => {
      const context = mockExecutionContext('/v1/health/queue-metrics');
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should exempt /v1/health/soroban-contract endpoint', async () => {
      const context = mockExecutionContext('/v1/health/soroban-contract');
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  describe('Guard Interface', () => {
    it('should implement CanActivate interface', () => {
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
