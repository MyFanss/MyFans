import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

export const CSRF_COOKIE = '__Host-csrf';
export const CSRF_HEADER = 'x-csrf-token';

/** Double-submit cookie CSRF protection for state-mutating requests. */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

  use(req: Request, res: Response, next: NextFunction): void {
    // Ensure a CSRF cookie exists (set on first GET, reused thereafter)
    let cookieToken: string = (req.cookies as Record<string, string>)?.[CSRF_COOKIE];
    if (!cookieToken) {
      cookieToken = crypto.randomBytes(32).toString('hex');
      res.cookie(CSRF_COOKIE, cookieToken, {
        httpOnly: false,   // must be readable by JS to echo in header
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      });
    }

    if (this.SAFE_METHODS.has(req.method.toUpperCase())) {
      return next();
    }

    const headerToken = req.headers[CSRF_HEADER] as string | undefined;
    if (!headerToken || !this.timingSafeEqual(headerToken, cookieToken)) {
      throw new ForbiddenException('Invalid or missing CSRF token');
    }

    next();
  }

  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}
