import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../common/enums/user-role.enum';
import { ExecutionContext } from '@nestjs/common';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflectorMock: jest.Mocked<Reflector>;

  beforeEach(async () => {
    reflectorMock = { getAllAndOverride: jest.fn() } as any;
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesGuard],
    })
      .useMocker((target) => {
        if (target === Reflector) {
          return reflectorMock;
        }
      })
      .compile();

    guard = module.get<RolesGuard>(RolesGuard);
  });

  it('should allow access if no roles required', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(undefined);
    const ctx = { switchToHttp: () => ({ getRequest: () => ({}) }) } as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow access if user has required role', () => {
    reflectorMock.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    const ctx = { 
      switchToHttp: () => ({ getRequest: () => ({ user: { role: UserRole.ADMIN } }) }) 
    } as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should deny access if user lacks required role', () => {
    reflectorMock.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    const ctx = { 
      switchToHttp: () => ({ getRequest: () => ({ user: { role: UserRole.USER } }) }) 
    } as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(false);
  });
});
