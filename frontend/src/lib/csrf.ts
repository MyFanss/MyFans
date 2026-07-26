import { getApiBaseUrl } from '@/lib/api/base-url';

const API_BASE = getApiBaseUrl();

let cached: string | null = null;

/** Fetch (and cache) the CSRF token from the BFF. Resets on 403. */
export async function getCsrfToken(): Promise<string> {
  if (cached) return cached;
  const res = await fetch(`${API_BASE}/v1/csrf/token`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`CSRF token fetch failed: ${res.status}`);
  const { csrfToken } = (await res.json()) as { csrfToken: string };
  cached = csrfToken;
  return csrfToken;
}

/** Call this when a 403 is received so the next request re-fetches. */
export function invalidateCsrfToken(): void {
  cached = null;
}
