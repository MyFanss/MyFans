# Auth Middleware — Cookie Name & Matcher

**Issue:** [#1658 Server-side Next middleware for protected routes](https://github.com/MyFanss/MyFans/issues/1658)

## Cookie name: `authToken`

The middleware checks for a cookie named **`authToken`**.

This matches the localStorage key used by `src/lib/auth-storage.ts`:

```ts
const AUTH_TOKEN_KEY = "authToken";
```

The client must set this cookie on successful sign-in so the middleware can read
it server-side. Example (called from the sign-in flow after wallet connect):

```ts
document.cookie = `authToken=${jwt}; path=/; SameSite=Strict; Secure`;
```

The middleware also accepts the token in an `Authorization: Bearer <token>` header
for API routes or SSR fetch calls that forward credentials.

## Protected route prefixes (matcher)

The following path prefixes require authentication:

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
- `/_next/*` — Next.js internals (excluded by matcher regex)

## Redirect behaviour

Logged-out requests to a protected route are redirected to:

```
/auth/sign-in?returnUrl=<original-pathname>
```

The response sets `Cache-Control: no-store` to prevent a cached redirect from
serving stale protected content.

## Role enforcement

The middleware only checks for the *presence* of the auth token — it does **not**
enforce creator vs fan roles. Role-level enforcement (e.g. blocking fans from
`/dashboard`) is handled by `RouteGuard` on the client, which calls `fetchMe()`
and checks `me.is_creator`. See also [ADR-001-role-model.md](./ADR-001-role-model.md).
