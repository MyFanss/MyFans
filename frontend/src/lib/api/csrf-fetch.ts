import { getCsrfToken, invalidateCsrfToken } from '@/lib/csrf';
import { createAppError } from '@/types/errors';

/** HTTP methods that mutate state and therefore require a CSRF token. */
const MUTATING_METHODS = ['POST', 'PATCH', 'DELETE', 'PUT'] as const;

/** Whether a request with this method must carry the CSRF double-submit token. */
export function methodNeedsCsrf(method: string = 'GET'): boolean {
  return MUTATING_METHODS.includes(
    method.toUpperCase() as (typeof MUTATING_METHODS)[number],
  );
}

/**
 * Return the CSRF header(s) to merge into a request for the given method:
 * `{ 'X-CSRF-Token': <token> }` for mutating methods, `{}` otherwise.
 *
 * Exported so non-`csrfFetch` callers (checkout, subscribe-confirm, plan
 * create) can opt in with a plain `{ ...headers, ...(await csrfHeaders(m)) }`
 * spread without duplicating token plumbing. See `docs/CSRF.md`.
 */
export async function csrfHeaders(
  method: string = 'GET',
): Promise<Record<string, string>> {
  if (!methodNeedsCsrf(method)) return {};
  try {
    return { 'X-CSRF-Token': await getCsrfToken() };
  } catch (err) {
    throw createAppError('CSRF_TOKEN_FETCH_FAILED', {
      message: 'Failed to fetch CSRF token',
      description: 'Could not validate request security. Please try again.',
      cause: err instanceof Error ? err : undefined,
    });
  }
}

/**
 * Attach the CSRF token to a `Headers` object for state-changing requests,
 * fetching it on demand. GET/HEAD are left untouched.
 */
export async function attachCsrf(
  headers: Headers,
  method: string = 'GET',
): Promise<Headers> {
  for (const [key, value] of Object.entries(await csrfHeaders(method))) {
    headers.set(key, value);
  }
  return headers;
}

/**
 * Wrapper for fetch that automatically includes the CSRF token in request
 * headers for state-changing requests (POST, PATCH, DELETE, PUT).
 *
 * 401 vs 403 are treated differently:
 *  - **401** → the session, not the CSRF token, is the problem. The CSRF
 *    token is left cached and an `UNAUTHORIZED` error is thrown so the
 *    caller can prompt for sign-in.
 *  - **403** → the CSRF token is stale/rejected. It is invalidated so the
 *    next request re-fetches, and a `CSRF_VALIDATION_FAILED` error is
 *    thrown.
 */
export async function csrfFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = await attachCsrf(new Headers(options.headers || {}), method);

  const response = await fetch(url, {
    ...options,
    // CSRF is a cookie double-submit scheme; the cookie must ride along.
    credentials: options.credentials ?? 'include',
    headers,
  });

  if (response.status === 401) {
    throw createAppError('UNAUTHORIZED', {
      message: 'Not authenticated',
      description: 'Your session has expired. Please sign in and try again.',
      context: { endpoint: url, statusCode: 401 },
    });
  }

  if (response.status === 403) {
    invalidateCsrfToken();
    throw createAppError('CSRF_VALIDATION_FAILED', {
      message: 'CSRF validation failed',
      description: 'Please refresh and try again.',
      context: { endpoint: url, statusCode: 403 },
    });
  }

  return response;
}
