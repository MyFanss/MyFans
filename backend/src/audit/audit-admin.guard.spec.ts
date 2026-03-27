import { ExecutionContext, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { AuditAdminGuard } from './audit-admin.guard';

describe('AuditAdminGuard', () => {
  const originalEnv = process.env.AUDIT_ADMIN_API_KEY;

  afterEach(() => {
    process.env.AUDIT_ADMIN_API_KEY = originalEnv;
  });

  function ctx(headers: Record<string, string>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    } as ExecutionContext;
  }

  it('allows when key matches', () => {
    process.env.AUDIT_ADMIN_API_KEY = 'secret-key';
    const guard = new AuditAdminGuard();
    expect(guard.canActivate(ctx({ 'x-admin-audit-key': 'secret-key' }))).toBe(true);
  });

  it('rejects when key mismatches', () => {
    process.env.AUDIT_ADMIN_API_KEY = 'secret-key';
    const guard = new AuditAdminGuard();
    expect(() =>
      guard.canActivate(ctx({ 'x-admin-audit-key': 'wrong' })),
    ).toThrow(UnauthorizedException);
  });

  it('503 when env not set', () => {
    delete process.env.AUDIT_ADMIN_API_KEY;
    const guard = new AuditAdminGuard();
    expect(() => guard.canActivate(ctx({}))).toThrow(ServiceUnavailableException);
  });
});
