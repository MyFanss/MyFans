import { Test, TestingModule } from '@nestjs/testing';
import { PublicGuard } from './public.guard';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { ExecutionContext } from '@nestjs/common';

describe('PublicGuard', () => {
  let guard: PublicGuard;
  let reflectorMock: jest.Mocked<Reflector>;

  beforeEach(async () => {
    reflectorMock = { getAllAndOverride: jest.fn() } as any;
    const module: TestingModule = await Test.createTestingModule({
      providers: [PublicGuard],
    })
      .useMocker((target) => {
        if (target === Reflector) {
          return reflectorMock;
        }
      })
      .compile();

    guard = module.get<PublicGuard>(PublicGuard);
  });

  it('should allow public access', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(true);
    const ctx = { } as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should deny non-public access', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(false);
    const ctx = { } as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(false);
  });
});
