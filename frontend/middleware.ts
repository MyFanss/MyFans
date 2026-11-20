import { NextRequest, NextResponse } from 'next/server';
import { demoRoutesEnabled, isDemoRoute } from '@/lib/demo-routes';
import { getApiBaseUrl } from '@/lib/api/base-url';

/**
 * Server-side middleware to protect authenticated routes.
 *
 * ## Cookie name
 * The auth token is stored in the HttpOnly `authToken` cookie (set by
 * /api/auth/session after a successful wallet-based sign-in).  Page scripts
 * cannot read it.  This middleware redirects unauthenticated requests before
 * any JavaScript runs, eliminating the first-paint flash of protected content
 * that the client RouteGuard cannot prevent.
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
 * ## Role enforcement
 * `/dashboard` and its children are creator-only.  The middleware asks the
 * backend session endpoint (`/v1/users/me`, the same identity `fetchMe()` uses)
 * for `is_creator` before the page renders.  Fans are redirected to /discover;
 * any failed lookup fails closed.  The role is never read from the client
 * (no query parameter, no unverified token claim).  RouteGuard stays as a
 * second check.  See also frontend/docs/ADR-001-role-model.md.
 *
 * ## Out of scope
 * Edge A/B testing.  Secret values are never written to middleware edge logs.
 *
 * Refs: #1829 (middleware protection), frontend/docs/AUTH_MIDDLEWARE.md
 */

// ── Protected route prefixes ──────────────────────────────────────────────
// Keep in sync with the table in frontend/docs/AUTH_MIDDLEWARE.md.

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

// ── Creator-only prefixes (subset of PROTECTED_PREFIXES) ──────────────────

const CREATOR_ONLY_PREFIXES = ['/dashboard'] as const;

// ── Public asset extensions (skip auth check even if under a protected path) ─

const PUBLIC_ASSET_EXTENSIONS = ['.ico', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.txt', '.xml'];

function isPublicAsset(pathname: string): boolean {
  return PUBLIC_ASSET_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}

// ── Token shape check ──────────────────────────────────────────────────────

/**
 * Minimal structural check for a JWT: exactly three non-empty dot-separated
 * segments (header.payload.signature).  Full signature verification cannot run
 * in Edge middleware without a backend call; the backend/RouteGuard performs
 * authoritative verification.  This catches obviously malformed tokens early.
 */
export function isStructurallyValidJwt(token: string): boolean {
  if (!token) {
    return false;
  }
  const parts = token.split('.');
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

// ── Session role lookup ────────────────────────────────────────────────────

/**
 * Resolves the caller's role from the backend session endpoint.
 * Any error, non-200 or missing flag resolves to 'fan' (fail closed).
 * Only a 401 resolves to 'anonymous'.
 */
async function sessionRole(authToken: string): Promise<'creator' | 'fan' | 'anonymous'> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/v1/users/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
      cache: 'no-store',
    });
    if (res.status === 401) return 'anonymous';
    if (!res.ok) return 'fan';
    const me = (await res.json()) as { is_creator?: unknown };
    return me.is_creator === true ? 'creator' : 'fan';
  } catch {
    return 'fan';
  }
}

// ── Middleware ─────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public static assets to avoid false-positive auth redirects.
  if (isPublicAsset(pathname)) {
    return NextResponse.next();
  }

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
    // Preserve the original path as returnUrl so sign-in can redirect back.
    const signInUrl = new URL('/auth/sign-in', request.url);
    signInUrl.searchParams.set('returnUrl', pathname);
    const response = NextResponse.redirect(signInUrl);
    // Prevent a cached redirect from leaking protected-route HTML.
    response.headers.set('Cache-Control', 'no-store');
    // Never log the token value — only record the protected path.
    return response;
  }

  // Expired JWT detection: reject tokens that are not three non-empty
  // dot-separated segments.  Full signature verification cannot run in Edge
  // middleware without a backend call; the backend/RouteGuard performs
  // authoritative verification.  This catches obviously malformed tokens early.
  if (!isStructurallyValidJwt(authToken)) {
    const signInUrl = new URL('/auth/sign-in', request.url);
    signInUrl.searchParams.set('returnUrl', pathname);
    signInUrl.searchParams.set('reason', 'invalid_token');
    const response = NextResponse.redirect(signInUrl);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  // Creator-only routes: confirm the role with the backend before rendering.
  const isCreatorOnlyRoute = CREATOR_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isCreatorOnlyRoute) {
    const role = await sessionRole(authToken);
    if (role === 'anonymous') {
      const signInUrl = new URL('/auth/sign-in', request.url);
      signInUrl.searchParams.set('returnUrl', pathname);
      const response = NextResponse.redirect(signInUrl);
      response.headers.set('Cache-Control', 'no-store');
      return response;
    }
    if (role !== 'creator') {
      const response = NextResponse.redirect(new URL('/discover', request.url));
      response.headers.set('Cache-Control', 'no-store');
      return response;
    }
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
 *
 * Documented protected prefixes (frontend/docs/AUTH_MIDDLEWARE.md):
 *   /dashboard, /settings, /messages, /earnings, /notifications,
 *   /profile, /subscriptions, /transactions, /pending, /checkout, /favorites
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)',
  ],
};
