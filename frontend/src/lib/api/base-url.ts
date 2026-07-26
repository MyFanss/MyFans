/**
 * Centralized API base URL resolution (#1455).
 *
 * Historically, every client module (api-client.ts, csrf.ts, checkout.ts,
 * favorites.ts, earnings-api.ts, notifications.ts, api/creators.ts,
 * api/posts.ts, api/profile.ts, ...) read `process.env.NEXT_PUBLIC_API_URL`
 * directly and each hardcoded its own fallback host/port for local dev
 * (a mix of `http://localhost:3000` and `http://localhost:3001`, with and
 * without `/api` or `/api/v1` suffixes). That drift meant overriding
 * `NEXT_PUBLIC_API_URL` in one environment didn't reliably affect every
 * client, and the "default" backend port depended on which file you read.
 *
 * All clients should now resolve the API origin through `getApiBaseUrl()`
 * (or `getConfiguredApiBaseUrl()` for callers that need a distinct,
 * same-origin-relative fallback, like `feature-flags.ts`) instead of
 * inlining their own `process.env.NEXT_PUBLIC_API_URL || '...'` default.
 *
 * See `docs/api-base-url.md` for the full migration notes.
 */

/**
 * Default backend origin used when `NEXT_PUBLIC_API_URL` is not set.
 *
 * Matches the backend's documented local-dev port (see
 * `docker-compose.yml`'s `NEXT_PUBLIC_API_URL: http://localhost:3001` and
 * `docker-compose.dev.yml`'s `PORT: ${PORT:-3001}`).
 */
export const DEFAULT_API_BASE_URL = 'http://localhost:3001';

/** Remove any trailing slash(es) from a URL/path segment. */
export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/**
 * Return the raw, trimmed `NEXT_PUBLIC_API_URL` value, or `undefined` if it
 * is not configured (empty string counts as not configured).
 *
 * Prefer `getApiBaseUrl()` unless you specifically need to distinguish
 * "not configured" from "configured" in order to apply a different
 * fallback (e.g. a same-origin relative URL instead of an absolute one).
 */
export function getConfiguredApiBaseUrl(): string | undefined {
  const value = process.env.NEXT_PUBLIC_API_URL;
  if (!value) return undefined;
  const trimmed = trimTrailingSlash(value.trim());
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Return the API base URL (no trailing slash): `NEXT_PUBLIC_API_URL` when
 * configured, otherwise `DEFAULT_API_BASE_URL`.
 *
 * This is intentionally just the origin (protocol + host + optional port,
 * or whatever custom base the caller configures, e.g. including its own
 * `/api` prefix in front-door/reverse-proxy deployments) — individual
 * clients are responsible for appending their own resource paths
 * (`/v1/creators`, `/favorites`, etc.) on top of this.
 */
export function getApiBaseUrl(): string {
  return getConfiguredApiBaseUrl() ?? DEFAULT_API_BASE_URL;
}

/**
 * Versioned API root for browser clients (no trailing slash).
 *
 * - When `NEXT_PUBLIC_API_URL` is unset → same-origin `/api/v1` (Next rewrite
 *   proxies to Nest `/v1/*`; see `next.config.ts`).
 * - When set to a bare Nest origin → `${origin}/v1`.
 * - When already ending in `/api`, `/v1`, or `/api/v1` → normalize accordingly.
 *
 * Prefer this for CSRF, notification preferences, and other cookie-auth
 * clients so paths stay aligned with Nest URI versioning.
 */
export function getVersionedApiBaseUrl(): string {
  const configured = getConfiguredApiBaseUrl();
  if (!configured) {
    return '/api/v1';
  }
  if (configured.endsWith('/api/v1') || configured.endsWith('/v1')) {
    return configured;
  }
  if (configured.endsWith('/api')) {
    return `${configured}/v1`;
  }
  return `${configured}/v1`;
}
