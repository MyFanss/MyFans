/**
 * Lightweight typed API client for the MyFans frontend.
 *
 * All requests go to the same-origin `/api/v1/` prefix which Next.js rewrites
 * to the Nest backend. Mutating requests (POST/PUT/PATCH/DELETE) carry the
 * CSRF token fetched from /api/v1/csrf/token.
 */

const CSRF_HEADER = 'x-csrf-token';
const IDEMPOTENCY_HEADER = 'idempotency-key';

let _csrfToken: string | null = null;

/**
 * Thrown when the CSRF token endpoint is unavailable (non-OK response,
 * network error, or an OK response with no token). This is distinct from a
 * successfully fetched token, so a broken endpoint is never mistaken for a
 * valid empty token.
 */
export class CsrfUnavailableError extends Error {
  constructor() {
    super('Could not obtain a CSRF token; the request was not sent.');
    this.name = 'CsrfUnavailableError';
  }
}

/**
 * Fetch a CSRF token from the backend.
 * Throws CsrfUnavailableError if the endpoint is unreachable, returns a
 * non-OK response, or returns no token — it never returns an empty string,
 * so callers can't mistake a failure for a valid (empty) token.
 */
async function fetchCsrfToken(): Promise<string> {
  let res: Response;
  try {
    res = await fetch('/api/v1/csrf/token', {
      method: 'GET',
      credentials: 'same-origin',
    });
  } catch {
    throw new CsrfUnavailableError();
  }
  if (!res.ok) throw new CsrfUnavailableError();
  const data = (await res.json()) as { csrfToken?: string };
  const token = data.csrfToken ?? '';
  if (!token) throw new CsrfUnavailableError();
  return token;
}

/**
 * Get the cached CSRF token, fetching one if needed. Throws
 * CsrfUnavailableError on failure; the failed attempt is never cached, so a
 * later call tries again.
 */
async function getCsrfToken(): Promise<string> {
  if (_csrfToken) return _csrfToken;
  const token = await fetchCsrfToken();
  _csrfToken = token;
  return _csrfToken;
}

/** Invalidate the cached CSRF token (e.g. after a 403 CSRF failure). */
function invalidateCsrfToken(): void {
  _csrfToken = null;
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface ApiOptions extends RequestInit {
  /** Provide an idempotency key for safe retries. */
  idempotencyKey?: string;
}

/**
 * Build a deterministic idempotency key for plan metadata writes.
 *
 * The key is derived solely from the on-chain plan id so that a retry after an
 * ambiguous failure (timeout, dropped response, tab reload) sends the exact
 * same key as the original attempt and the backend can deduplicate it. It must
 * never depend on Date.now() or Math.random(), which would produce a fresh key
 * on every call and defeat deduplication.
 */
export function metadataIdempotencyKey(planId: string): string {
  return `plan-metadata:${planId}`;
}

/**
 * Build a synthetic 503 response for when the CSRF token could not be
 * obtained. The mutation is never sent in this case; this response lets
 * callers show that the session could not be prepared rather than surfacing
 * an opaque CSRF error.
 */
function csrfUnavailableResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'csrf_unavailable',
      message: 'Could not prepare a secure session. Please try again.',
    }),
    { status: 503, headers: { 'Content-Type': 'application/json' } },
  );
}

/**
 * Perform an API request against /api/v1/*. Mutating methods automatically
 * attach the CSRF token and retry once on a CSRF failure. If the CSRF token
 * cannot be obtained, the mutation is never sent and a synthetic 503 is
 * returned instead.
 */
export async function apiFetch(path: string, options: ApiOptions = {}): Promise<Response> {
  const method = (options.method ?? 'GET').toUpperCase();
  const isMutating = MUTATING.has(method);
  const hasBody = options.body !== undefined;

  const buildHeaders = async (): Promise<Headers> => {
    const h = new Headers(options.headers ?? {});
    // Only set Content-Type when the request actually has (or will have) a
    // body — a GET/HEAD with no body should not claim a JSON content type.
    if (isMutating || hasBody) {
      h.set('Content-Type', 'application/json');
    }
    if (isMutating) {
      // Throws CsrfUnavailableError if the token can't be obtained; the
      // caller below treats that as "do not send the mutation".
      const token = await getCsrfToken();
      h.set(CSRF_HEADER, token);
    }
    if (options.idempotencyKey) {
      h.set(IDEMPOTENCY_HEADER, options.idempotencyKey);
    }
    return h;
  };

  const url = path.startsWith('/') ? path : `/api/v1/${path}`;

  let headers: Headers;
  try {
    headers = await buildHeaders();
  } catch (err) {
    if (err instanceof CsrfUnavailableError) return csrfUnavailableResponse();
    throw err;
  }

  let res = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: 'same-origin',
  });

  // Retry once on CSRF failure
  if (isMutating && res.status === 403) {
    invalidateCsrfToken();
    let retryHeaders: Headers;
    try {
      retryHeaders = await buildHeaders();
    } catch (err) {
      if (err instanceof CsrfUnavailableError) return csrfUnavailableResponse();
      throw err;
    }
    res = await fetch(url, {
      ...options,
      method,
      headers: retryHeaders,
      credentials: 'same-origin',
    });
  }

  return res;
}
