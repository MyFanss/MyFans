# CSRF tokens on mutating requests

The Nest backend mounts a global `CsrfMiddleware` on every
`POST` / `PUT` / `PATCH` / `DELETE`. It is a **double-submit** scheme: the
server sets a CSRF cookie, and the client must echo the same value back in
the `X-CSRF-Token` request header. A browser client that sends the cookie
but omits the header gets a `403` — which, in the checkout / subscribe
flows, previously surfaced to users as an opaque *"wallet failed"*.

## How the frontend attaches it

`src/lib/api/csrf-fetch.ts` is the single source of truth:

| Export | Use it when |
| --- | --- |
| `csrfFetch(url, init)` | You control the whole request — it wraps `fetch`, adds the header for mutating methods, forces `credentials: 'include'`, and maps `401`/`403` to typed errors. |
| `csrfHeaders(method)` | You already build a `headers` object and just want to merge in `{ 'X-CSRF-Token': ... }` — returns `{}` for `GET`/`HEAD`. |
| `attachCsrf(headers, method)` | You have a `Headers` instance to mutate in place. |

`getCsrfToken()` (`src/lib/csrf.ts`) fetches `/{api/}v1/csrf/token` once and
caches it; `invalidateCsrfToken()` clears the cache so the next call
re-fetches.

### Call sites covered

- **Checkout** — `createCheckout`, `validateBalance`, `confirmSubscription`,
  `failCheckout` (`src/lib/checkout.ts`) all go through `csrfHeaders('POST')`.
- **Subscribe confirm** — same `confirmSubscription` path.
- **Plan create** — `createPlan` (`src/lib/api/plans.ts`) merges
  `csrfHeaders('POST')` alongside its `Idempotency-Key`.

`GET` requests are never given a token and are unaffected.

## 401 vs 403

`csrfFetch` deliberately separates them:

- **401 Unauthorized** — the *session* is the problem, not the token. The
  cached CSRF token is left intact and an `UNAUTHORIZED` `AppError` is
  thrown so the caller can prompt for sign-in.
- **403 Forbidden** — the CSRF token is stale or rejected. It is
  invalidated (so a retry re-fetches) and a `CSRF_VALIDATION_FAILED`
  `AppError` is thrown.

## Mobile wallets / in-app webviews

The token ride-along depends on the CSRF **cookie** being sent, so every
mutating request also sets `credentials: 'include'`. In an embedded webview
(a mobile wallet's in-app browser, an OAuth popup, etc.) third-party /
partitioned-cookie rules can drop that cookie:

- Serve the frontend and API on the **same registrable domain** (e.g.
  `app.example.com` + `api.example.com`) so the CSRF cookie is first-party.
- The CSRF cookie must be `SameSite=Lax` or `SameSite=None; Secure` — never
  `Strict`, or a link into the webview strips it on the first navigation.
- If a webview blocks cookies entirely, the client falls back to bearer
  auth (`Authorization: Bearer …` from `@/lib/auth-storage`). A pure
  bearer, no-cookie client is exempt from CSRF on the backend — see
  **bearer-only exception** below.

## bearer-only exception (native apps)

Native apps that authenticate solely with a bearer token and never rely on
cookies are not vulnerable to CSRF and are exempt. If/when that exemption
is added on the backend it must be scoped to *requests with no cookie and a
valid `Authorization` header* and documented here.

## Tests

- `src/lib/csrf.test.ts` — token fetch, caching, invalidation.
- `src/lib/api/csrf-fetch.test.ts` — header attachment for mutating methods,
  the 401-vs-403 split, `credentials: 'include'`, checkout-shaped URLs.
- `src/lib/api/plans.test.ts` — `createPlan` sends `X-CSRF-Token`.
