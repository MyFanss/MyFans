/**
 * Auth session helpers.
 *
 * The JWT lives only in an HttpOnly `authToken` cookie, set and cleared by the
 * same-origin route handler at /api/auth/session. Page scripts never see the
 * token again, so XSS cannot read it from localStorage or document.cookie.
 * Edge middleware reads the cookie from the request.
 *
 * Refs: frontend/docs/AUTH_MIDDLEWARE.md, #1828, #1829, #2185
 */

export const AUTH_TOKEN_KEY = 'authToken';

const SESSION_ENDPOINT = '/api/auth/session';

/**
 * Start a session after a successful wallet sign-in.
 * Throws if the server rejects the token or cannot set the cookie.
 */
export async function setAuthToken(token: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const res = await fetch(SESSION_ENDPOINT, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    throw new Error('Could not start your session. Please try again.');
  }
  // Drop any JWT copy written by older builds.
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // ignore
  }
}

/**
 * End the session on sign-out. The cookie is HttpOnly, so only the server can expire it.
 */
export async function clearAuthToken(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch(SESSION_ENDPOINT, { method: 'DELETE', credentials: 'same-origin' });
  } catch {
    // Network failure: the cookie stays until the next successful sign-out.
  }
  // Expire the cookie immediately. Reuse the same `Secure` suffix as
  // setAuthToken so we clear the cookie that was actually written on https.
  // `isSecureContext` is a global boolean (Window.isSecureContext), not a
  // function — calling it as `isSecureContext()` throws a TypeError and
  // would abort sign-out before the cookie/localStorage cleanup below runs.
  // Pre-existing bug, fixed here because it directly blocks this function.
  const secure = isSecureContext ? '; Secure' : '';
  document.cookie = `${AUTH_TOKEN_KEY}=; path=/; SameSite=Strict; expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0${secure}`;
  // Drop any legacy JWT copy too, so sign-out clears both places a token
  // could still live rather than leaving a stale copy for getAuthToken-style
  // code (current or future) to pick back up once the cookie is gone.
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // ignore
  }
}
