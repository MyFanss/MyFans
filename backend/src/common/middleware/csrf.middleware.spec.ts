import { ForbiddenException } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';
import { CsrfMiddleware, CSRF_COOKIE, CSRF_HEADER } from './csrf.middleware';

const TOKEN = crypto.randomBytes(32).toString('hex');

function makeReq(
  method: string,
  cookies: Record<string, string> = {},
  headers: Record<string, string> = {},
): Partial<Request> {
  return { method, cookies, headers } as any;
}

function makeRes(): { cookie: jest.Mock; _cookies: Record<string, string> } {
  const res: any = { _cookies: {} };
  res.cookie = jest.fn((name: string, value: string) => {
    res._cookies[name] = value;
  });
  return res;
}

describe('CsrfMiddleware', () => {
  let middleware: CsrfMiddleware;

  beforeEach(() => {
    middleware = new CsrfMiddleware();
  });

  it('sets a CSRF cookie when none exists on a GET', () => {
    const req = makeReq('GET');
    const res = makeRes();
    const next = jest.fn();

    middleware.use(req as any, res as any, next);

    expect(res.cookie).toHaveBeenCalledWith(
      CSRF_COOKIE,
      expect.any(String),
      expect.objectContaining({ httpOnly: false, sameSite: 'strict' }),
    );
    expect(next).toHaveBeenCalled();
  });

  it('passes safe methods without checking header', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      const req = makeReq(method, { [CSRF_COOKIE]: TOKEN });
      const res = makeRes();
      const next = jest.fn();

      middleware.use(req as any, res as any, next);

      expect(next).toHaveBeenCalled();
    }
  });

  it('allows POST when header matches cookie', () => {
    const req = makeReq('POST', { [CSRF_COOKIE]: TOKEN }, { [CSRF_HEADER]: TOKEN });
    const res = makeRes();
    const next = jest.fn();

    middleware.use(req as any, res as any, next);

    expect(next).toHaveBeenCalled();
  });

  it('throws ForbiddenException when header is missing on POST', () => {
    const req = makeReq('POST', { [CSRF_COOKIE]: TOKEN });
    const res = makeRes();
    const next = jest.fn();

    expect(() => middleware.use(req as any, res as any, next)).toThrow(ForbiddenException);
    expect(next).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when header does not match cookie', () => {
    const req = makeReq('POST', { [CSRF_COOKIE]: TOKEN }, { [CSRF_HEADER]: 'wrong-token' });
    const res = makeRes();
    const next = jest.fn();

    expect(() => middleware.use(req as any, res as any, next)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when no cookie and mutating method', () => {
    const req = makeReq('DELETE', {}, { [CSRF_HEADER]: TOKEN });
    const res = makeRes();
    const next = jest.fn();

    // Cookie will be freshly set but won't match the stale header value
    expect(() => middleware.use(req as any, res as any, next)).toThrow(ForbiddenException);
  });
});
