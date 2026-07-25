import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

export const CSRF_COOKIE = '__Host-csrf';
export const CSRF_HEADER = 'x-csrf-token';

/**
 * Double-submit cookie CSRF protection for state-mutating requests.
 *
 * Only cookie-authenticated clients are exposed to CSRF: browsers attach
 * cookies automatically to cross-site requests, but never attach an
 * `Authorization` header on their own. Bearer-only clients (mobile apps, CLI
 * tools, server-to-server callers) are therefore exempted — see
 * backend/docs/AUTH_MODES.md for the full breakdown of auth modes.
 */
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

    if (this.isBearerClient(req)) {
      return next();
    }

    const headerToken = req.headers[CSRF_HEADER] as string | undefined;
    if (!headerToken || !this.timingSafeEqual(headerToken, cookieToken)) {
      throw new ForbiddenException('Invalid or missing CSRF token');
    }

    next();
  }

  /** Requests authenticated via a Bearer token are not subject to CSRF. */
  private isBearerClient(req: Request): boolean {
    const authHeader = req.headers['authorization'];
    return (
      typeof authHeader === 'string' &&
      authHeader.toLowerCase().startsWith('bearer ')
    );
  }

  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}
