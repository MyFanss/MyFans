import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../common/enums/user-role.enum';
import { ExecutionContext } from '@nestjs/common';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflectorMock: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflectorMock = { getAllAndOverride: jest.fn() } as any;
    guard = new RolesGuard(reflectorMock);
  });

  it('should allow access if no roles required', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(undefined);
    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow access if user has required role', () => {
    reflectorMock.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    const ctx = { 
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user: { role: UserRole.ADMIN } }) }) 
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should deny access if user lacks required role', () => {
    reflectorMock.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    const ctx = { 
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user: { role: UserRole.USER } }) }) 
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(false);
  });
});
