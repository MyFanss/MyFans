import { getCookie } from './cookies';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Routes that require a CSRF token on mutating requests.
 * Demo routes are exempt (see frontend/docs/CSRF.md).
 */
const CSRF_PROTECTED_ROUTES: RegExp[] = [
  /^\/api\/checkout(\/|$)/,
  /^\/api\/subscribe\/confirm(\/|$)/,
  /^\/api\/plans(\/|$)/,
  /^\/api\/settings(\/|$)/,
];

const CSRF_EXEMPT_ROUTES: RegExp[] = [/^\/api\/demo(\/|$)/];

export class CsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsrfError';
  }
}

function isMutating(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase());
}

function requiresCsrf(path: string): boolean {
  if (CSRF_EXEMPT_ROUTES.some((re) => re.test(path))) {
    return false;
  }
  return CSRF_PROTECTED_ROUTES.some((re) => re.test(path));
}

/**
 * Read the CSRF token from the cookie set by the backend.
 * Returns null when the cookie is absent or empty.
 */
export function getCsrfToken(): string | null {
  const token = getCookie(CSRF_COOKIE_NAME);
  return token && token.length > 0 ? token : null;
}

/**
 * Fetch a fresh CSRF token from the backend. Used to refresh an expired token
 * before retrying a rejected request.
 */
async function refreshCsrfToken(): Promise<string | null> {
  try {
    await fetch('/api/csrf', {
      method: 'GET',
      credentials: 'same-origin',
    });
  } catch {
    return null;
  }
  return getCsrfToken();
}

function isCsrfFailure(status: number, body: unknown): boolean {
  if (status !== 403) {
    return false;
  }
  if (body && typeof body === 'object') {
    const code = (body as { code?: string; error?: string }).code;
    const error = (body as { code?: string; error?: string }).error;
    return code === 'CSRF_FAILED' || error === 'CSRF_FAILED';
  }
  return false;
}

async function parseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  return null;
}

export interface ApiRequestOptions extends RequestInit {
  /** Skip CSRF handling entirely (e.g. for public/demo endpoints). */
  skipCsrf?: boolean;
}

/**
 * Perform an API request, attaching the CSRF header to protected mutating
 * requests and retrying once with a refreshed token on CSRF failure.
 */
export async function apiRequest(
  path: string,
  options: ApiRequestOptions = {},
): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const needsCsrf = !options.skipCsrf && isMutating(method) && requiresCsrf(path);

  const buildInit = (token: string | null): RequestInit => {
    const headers = new Headers(options.headers || {});
    if (needsCsrf && token) {
      headers.set(CSRF_HEADER_NAME, token);
    }
    return {
      ...options,
      method,
      headers,
      credentials: options.credentials || 'same-origin',
    };
  };

  let token: string | null = null;
  if (needsCsrf) {
    token = getCsrfToken();
    if (!token) {
      token = await refreshCsrfToken();
    }
    if (!token) {
      throw new CsrfError(
        'Missing CSRF token. Ensure the CSRF cookie is set before making this request.',
      );
    }
  }

  let response = await fetch(path, buildInit(token));

  if (needsCsrf && response.status === 403) {
    const body = await parseBody(response.clone());
    if (isCsrfFailure(response.status, body)) {
      const refreshed = await refreshCsrfToken();
      if (!refreshed) {
        throw new CsrfError(
          'CSRF token expired and could not be refreshed. Please reload and try again.',
        );
      }
      response = await fetch(path, buildInit(refreshed));
    }
  }

  return response;
}
