import { PublicGuard } from './public.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';

describe('PublicGuard', () => {
  let guard: PublicGuard;
  let reflectorMock: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflectorMock = { getAllAndOverride: jest.fn() } as any;
    guard = new PublicGuard(reflectorMock);
  });

  it('should allow public access', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(true);
    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should deny non-public access', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(false);
    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(false);
  });
});
