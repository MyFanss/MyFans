import { NextRequest, NextResponse } from 'next/server';
import { demoRoutesEnabled, isDemoRoute } from '@/lib/demo-routes';

/**
 * Middleware to protect authenticated routes.
 *
 * Redirects unauthenticated users to /auth/login with a return URL.
 * Only protects specific routes: /dashboard, /settings, /earnings, /notifications, /profile, /subscriptions, /transactions.
 *
 * Authentication is checked via the 'authToken' cookie or 'Authorization' header.
 */

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/settings',
  '/earnings',
  '/notifications',
  '/profile',
  '/subscriptions',
  '/transactions',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Demo / component-story routes. When demos are disabled (a plain
  // production build) they are not compiled at all and 404 on their own;
  // this is defense-in-depth in case one is ever reachable. When they are
  // enabled (dev / staging preview) keep them out of search indexes.
  if (isDemoRoute(pathname)) {
    if (!demoRoutesEnabled()) {
      // Demos are excluded from the prod build entirely, so this only fires
      // on a misconfiguration — a bare 404 is fine here.
      return new NextResponse('Not Found', { status: 404 });
    }
    const res = NextResponse.next();
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return res;
  }

  // Check if the current route needs authentication
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Check for authentication token in cookies or headers
  const authToken = request.cookies.get('authToken')?.value ||
                    request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!authToken) {
    // Redirect to login with return URL
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Token exists, allow request to proceed
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
