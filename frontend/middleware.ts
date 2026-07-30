import { NextRequest, NextResponse } from 'next/server';

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
