/**
 * Demo / component-story routes.
 *
 * These pages exist only to exercise components in isolation. They must not
 * be reachable in a production build: they leak internal components, confuse
 * SEO, and widen the attack surface (e.g. `/error-test` deliberately throws).
 *
 * Access rule: available when NOT a production build, OR when explicitly
 * opted in with `NEXT_PUBLIC_FLAG_DEMOS=true` (e.g. a staging preview where
 * designers need them). Production without the flag → 404.
 *
 * See `docs/DEMO_ROUTES.md`.
 */

/** URL path prefixes that are demo-only. Keep in sync with `src/app/*`. */
export const DEMO_ROUTES = [
  '/wallet-demo',
  '/error-test',
  '/ui',
  '/subscribe-example',
  '/settings-demo',
] as const;

/** True when the current runtime is allowed to serve demo routes. */
export function demoRoutesEnabled(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.NEXT_PUBLIC_FLAG_DEMOS === 'true';
}

/** True when `pathname` belongs to a demo route. */
export function isDemoRoute(pathname: string): boolean {
  return DEMO_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
