/**
 * Auth storage helpers.
 *
 * The auth token is kept in both localStorage (for client-side reads) and as a
 * cookie so the Next.js Edge middleware can read it server-side without a
 * backend round-trip.
 *
 * Cookie attributes:
 *   - path=/           – accessible from all routes
 *   - SameSite=Strict  – CSRF mitigation
 *   - Secure           – only sent over HTTPS in production
 *
 * Refs: frontend/docs/AUTH_MIDDLEWARE.md, #1828, #1829
 */

export const AUTH_TOKEN_KEY = 'authToken';

function isSecureContext(): boolean {
  if (typeof window === 'undefined') return true; // SSR: assume secure
  return window.location.protocol === 'https:' || window.location.hostname === 'localhost';
}

/**
 * Persist the JWT after a successful wallet sign-in.
 * Writes both localStorage and the `authToken` cookie.
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    // Private browsing / storage quota: localStorage may be unavailable.
  }
  const secure = isSecureContext() ? '; Secure' : '';
  document.cookie = `${AUTH_TOKEN_KEY}=${encodeURIComponent(token)}; path=/; SameSite=Strict${secure}`;
}

/**
 * Read the auth token from localStorage.
 * Returns null when not authenticated.
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Remove the auth token from both localStorage and the cookie.
 * Call on sign-out.
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // ignore
  }
  // Expire the cookie immediately.
  document.cookie = `${AUTH_TOKEN_KEY}=; path=/; SameSite=Strict; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
