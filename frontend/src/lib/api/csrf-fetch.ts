import { getCsrfToken, invalidateCsrfToken } from '@/lib/csrf';
import { createAppError } from '@/types/errors';

/**
 * Wrapper for fetch that automatically includes CSRF token in request headers
 * for state-changing requests (POST, PATCH, DELETE, PUT).
 * Automatically invalidates token on 403 response.
 */
export async function csrfFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();

  // Only fetch CSRF token for state-changing methods
  const needsCsrf = ['POST', 'PATCH', 'DELETE', 'PUT'].includes(method);

  const headers = new Headers(options.headers || {});

  if (needsCsrf) {
    try {
      const csrfToken = await getCsrfToken();
      headers.set('X-CSRF-Token', csrfToken);
    } catch (err) {
      throw createAppError('CSRF_TOKEN_FETCH_FAILED', {
        message: 'Failed to fetch CSRF token',
        description: 'Could not validate request security. Please try again.',
        cause: err instanceof Error ? err : undefined,
      });
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Invalidate token on 403 so next request re-fetches
  if (response.status === 403) {
    invalidateCsrfToken();
    throw createAppError('CSRF_VALIDATION_FAILED', {
      message: 'Request security validation failed',
      description: 'Please refresh and try again.',
    });
  }

  return response;
}
