import { NextRequest, NextResponse } from 'next/server';
import { demoRoutesEnabled, isDemoRoute } from '@/lib/demo-routes';

/**
 * Server-side middleware to protect authenticated routes.
 *
 * ## Cookie name
 * The auth token is stored in the `authToken` cookie (set by the client after
 * a successful wallet-based sign-in).  The same key is used in localStorage by
 * `auth-storage.ts`; the cookie counterpart allows this middleware to redirect
 * unauthenticated requests before any JavaScript runs, eliminating the first-
 * paint flash of protected content that the client RouteGuard cannot prevent.
 *
 * ## Redirect target
 * Unauthenticated requests are sent to `/auth/sign-in` (not `/auth/login`).
 * The original pathname is forwarded as `returnUrl` so the sign-in page can
 * bounce the user back after connecting their wallet.
 *
 * ## Matcher
 * The `config.matcher` at the bottom of this file lists the exact path prefixes
 * that are protected.  Public routes (/, /discover, /creator/:username, etc.)
 * are intentionally excluded so marketing pages and creator profiles return 200
 * for logged-out visitors without any redirect overhead.
 *
 * ## Out of scope
 * Role-level enforcement (creator vs fan) is handled by RouteGuard on the
 * client, because it requires a `/users/me` fetch that cannot run in Edge
 * middleware without a backend call.
 */

// ── Protected route prefixes ──────────────────────────────────────────────

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/settings',
  '/messages',
  '/earnings',
  '/notifications',
  '/profile',
  '/subscriptions',
  '/transactions',
  '/pending',
  '/checkout',
  '/favorites',
] as const;

// ── Middleware ─────────────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Demo / story routes ──────────────────────────────────────────────────
  // When demos are disabled (production build) these files are never compiled,
  // so this is purely defense-in-depth.  When enabled (dev/staging) we keep
  // them out of search indexes.
  if (isDemoRoute(pathname)) {
    if (!demoRoutesEnabled()) {
      return new NextResponse('Not Found', { status: 404 });
    }
    const res = NextResponse.next();
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return res;
  }

  // ── Auth check for protected routes ─────────────────────────────────────
  const isProtectedRoute = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Accept auth token from cookie (primary) or Authorization header (API /
  // SSR fetch calls that forward the bearer token as a header).
  const authToken =
    request.cookies.get('authToken')?.value ??
    request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');

  if (!authToken) {
    // Redirect to sign-in with original path as return URL.
    const signInUrl = new URL('/auth/sign-in', request.url);
    signInUrl.searchParams.set('returnUrl', pathname);
    const response = NextResponse.redirect(signInUrl);
    // Ensure no dashboard HTML leaks into the response body even if a cached
    // version exists upstream.
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  return NextResponse.next();
}

/**
 * Matcher documentation
 * ─────────────────────
 * The regex below matches every request path *except*:
 *   - _next/static  – compiled JS/CSS assets
 *   - _next/image   – Next.js image optimisation endpoint
 *   - favicon.ico, robots.txt, sitemap.xml – static public files
 *
 * Protected routes are checked inside the function body above; all other
 * paths pass through without any auth check.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)',
  ],
};
