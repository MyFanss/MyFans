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
 * Fetch (and cache) a CSRF token from the backend.
 * Returns an empty string if the endpoint is unreachable.
 */
async function fetchCsrfToken(): Promise<string> {
  try {
    const res = await fetch('/api/v1/csrf/token', {
      method: 'GET',
      credentials: 'same-origin',
    });
    if (!res.ok) return '';
    const data = (await res.json()) as { csrfToken?: string };
    return data.csrfToken ?? '';
  } catch {
    return '';
  }
}

async function getCsrfToken(): Promise<string> {
  if (_csrfToken) return _csrfToken;
  _csrfToken = await fetchCsrfToken();
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
 * Perform an API request against /api/v1/*. Mutating methods automatically
 * attach the CSRF token and retry once on a CSRF failure.
 */
export async function apiFetch(path: string, options: ApiOptions = {}): Promise<Response> {
  const method = (options.method ?? 'GET').toUpperCase();
  const isMutating = MUTATING.has(method);

  const buildHeaders = async (): Promise<Headers> => {
    const h = new Headers(options.headers ?? {});
    h.set('Content-Type', 'application/json');
    if (isMutating) {
      const token = await getCsrfToken();
      if (token) h.set(CSRF_HEADER, token);
    }
    if (options.idempotencyKey) {
      h.set(IDEMPOTENCY_HEADER, options.idempotencyKey);
    }
    return h;
  };

  const url = path.startsWith('/') ? path : `/api/v1/${path}`;

  let res = await fetch(url, {
    ...options,
    method,
    headers: await buildHeaders(),
    credentials: 'same-origin',
  });

  // Retry once on CSRF failure
  if (isMutating && res.status === 403) {
    invalidateCsrfToken();
    res = await fetch(url, {
      ...options,
      method,
      headers: await buildHeaders(),
      credentials: 'same-origin',
    });
  }

  return res;
}
