/**
 * Cookie utilities for client-side reads.
 *
 * Only to be used in browser contexts; returns null under SSR.
 */

/**
 * Read a cookie value by name.
 * Returns null when running server-side or when the cookie is absent.
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp('(?:^|;\\s*)' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'),
  );
  return match ? decodeURIComponent(match[1]) : null;
}
