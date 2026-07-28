import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflectorMock: jest.Mocked<Reflector>;

  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    reflectorMock = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    guard = new JwtAuthGuard(reflectorMock);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows routes marked @Public() without authenticating', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(true);
    const superSpy = jest.spyOn(AuthGuard('jwt').prototype, 'canActivate');

    expect(guard.canActivate(context)).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(reflectorMock.getAllAndOverride).toHaveBeenCalledWith(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    expect(superSpy).not.toHaveBeenCalled();
  });

  it('delegates to passport JWT authentication on protected routes', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(undefined);
    const superSpy = jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockReturnValue(true);

    expect(guard.canActivate(context)).toBe(true);
    expect(superSpy).toHaveBeenCalledWith(context);
  });
});
