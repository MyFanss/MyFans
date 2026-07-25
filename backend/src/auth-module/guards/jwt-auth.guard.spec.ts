import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from './jwt-auth.guard';

const mockExecutionContext = (user: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [JwtAuthGuard, Reflector],
    }).compile();

    guard = module.get(JwtAuthGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('req.user carries userId, not id', () => {
    const payload = { userId: 'user-uuid', email: 'a@b.com', role: 'fan' };
    const ctx = mockExecutionContext(payload);
    const user = ctx.switchToHttp().getRequest().user as typeof payload;

    expect(user.userId).toBe('user-uuid');
    expect((user as any).id).toBeUndefined();
  });
});
