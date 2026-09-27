/**
 * Demo / story route helpers.
 *
 * Demo routes are compiled only when demoRoutesEnabled() returns true.
 * This module is imported by both next.config.ts (build time) and
 * middleware.ts (edge runtime) so it must be free of browser globals.
 */

const DEMO_ROUTE_PREFIX = '/demo';

export function demoRoutesEnabled(): boolean {
  const isProd = process.env.NODE_ENV === 'production';
  return !isProd || process.env.NEXT_PUBLIC_FLAG_DEMOS === 'true';
}

export function isDemoRoute(pathname: string): boolean {
  return pathname === DEMO_ROUTE_PREFIX || pathname.startsWith(`${DEMO_ROUTE_PREFIX}/`);
}
