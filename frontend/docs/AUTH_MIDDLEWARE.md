# Auth Middleware — Cookie Name, Matcher & Route Documentation

**Issue:** [#1829 Next middleware protection for dashboard/settings/messages](https://github.com/MyFanss/MyFans/issues/1829)

## Cookie name: `authToken`

The middleware checks for a cookie named **`authToken`**.

This matches the key used by `src/lib/auth-storage.ts`:

```ts
export const AUTH_TOKEN_KEY = 'authToken';
```

The client sets this cookie on successful wallet sign-in via `setAuthToken()`:

```ts
document.cookie = `authToken=${token}; path=/; SameSite=Strict; Secure`;
```

The middleware also accepts the token in an `Authorization: Bearer <token>` header
for API routes or SSR fetch calls that forward credentials.

> **Security:** The cookie value is never written to edge logs.  Only the protected
> path is logged (as the `returnUrl` query parameter on redirect).

## Protected route prefixes

The following path prefixes require authentication.  Unauthenticated requests are
redirected to `/auth/sign-in?returnUrl=<original-pathname>`.

| Prefix           | Notes                               |
|------------------|-------------------------------------|
| `/dashboard`     | Creator-only (RouteGuard enforces)  |
| `/settings`      | All authenticated users             |
| `/messages`      | All authenticated users             |
| `/earnings`      | All authenticated users             |
| `/notifications` | All authenticated users             |
| `/profile`       | All authenticated users             |
| `/subscriptions` | Fan/creator subscribers             |
| `/transactions`  | All authenticated users             |
| `/pending`       | All authenticated users             |
| `/checkout`      | All authenticated users             |
| `/favorites`     | All authenticated users             |

## Public routes (no auth check)

The following are explicitly **not** protected and return 200 for logged-out users:

- `/` — home/landing page
- `/discover` — public creator discovery
- `/creator/:username` — public creator profile
- `/auth/sign-in` — sign-in page
- `/auth/*` — all auth pages
- `/onboarding` — role selection onboarding
- `/onboarding/fan` — fan quickstart onboarding
- `/_next/*` — Next.js internals (excluded by matcher regex)

## Redirect behaviour

Logged-out requests to a protected route are redirected to:

```
/auth/sign-in?returnUrl=<original-pathname>
```

Structurally malformed JWT tokens (not three dot-separated segments) redirect to:

```
/auth/sign-in?returnUrl=<original-pathname>&reason=invalid_token
```

Both responses set `Cache-Control: no-store` to prevent cached redirects from
serving stale protected HTML.

## Public asset short-circuit

Requests for common static asset extensions (`.ico`, `.png`, `.jpg`, `.svg`,
`.webp`, `.txt`, `.xml`) bypass the auth check to prevent false-positive redirects
on favicon or social preview requests.

## Role enforcement

The middleware only checks for the *presence* of a structurally valid auth token.
It does **not** enforce creator vs fan roles.  Role-level enforcement (e.g.
blocking fans from `/dashboard`) is handled by `RouteGuard` on the client, which
calls `fetchMe()` and checks `me.is_creator`.

See also [ADR-001-role-model.md](./ADR-001-role-model.md).

## Out of scope

Edge A/B testing.  Full JWT signature verification (requires backend call; handled
by the backend and `RouteGuard`).
