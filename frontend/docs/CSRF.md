# CSRF Protection for the Browser SPA

This document describes how the browser SPA participates in the backend's
CSRF double-submit cookie scheme, and the exception policy for native/mobile
clients. See also `backend/docs/CSRF_MOBILE_SPA.md`.

## How it works

The backend issues a CSRF cookie alongside the session cookie. The SPA must
read that cookie and echo its value back in a request header on every mutating
request. The backend compares the header value against the cookie value; if the
header is missing or does not match, the request is rejected with `403`.

- Cookie: `csrf_token` (set by the backend, `SameSite` and `Secure` per
  environment, explicit `Domain`).
- Header: `X-CSRF-Token`.
- Applies to mutating methods (`POST`, `PUT`, `PATCH`, `DELETE`) on `/v1`
  routes when authentication is via cookie.

## Attaching the token in the api-client

The api-client reads the CSRF cookie and attaches it as a header on mutating
requests. A minimal helper:

```ts
const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'X-CSRF-Token';

function readCookie(name: string): string | null {
  const match = document.cookie.match(
    new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function attachCsrf(headers: Record<string, string>, method: string): void {
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
  if (!mutating) return;
  const token = readCookie(CSRF_COOKIE);
  if (token) headers[CSRF_HEADER] = token;
}
```

Call `attachCsrf` when building request headers for every mutating call,
including checkout and subscribe flows. Do not special-case or exempt any
mutating route.

## Failure modes

- Missing header on a cookie-authenticated mutating request: `403`.
- Header present but not matching the cookie: `403`.
- Cross-site request without the header: rejected.

## Native / mobile exception policy

Native and mobile clients authenticate with a Bearer token rather than a
cookie. Because there is no ambient cookie credential, CSRF does not apply and
these clients do not send the CSRF header. This exception is limited to
Bearer-only authentication; browser SPA requests that rely on cookie auth must
always send the CSRF header.

## Testing

- Backend coverage lives in `backend/test/csrf.e2e-spec.ts`.
- Frontend unit tests should assert that the api-client attaches the
  `X-CSRF-Token` header on mutating requests and omits it on safe methods.
