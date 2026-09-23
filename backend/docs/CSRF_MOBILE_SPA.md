# CSRF Protection — Mobile & SPA Integration

## Overview

MyFans uses a **double-submit cookie** pattern for CSRF protection. Browser-based
clients must read a CSRF cookie and echo its value in a request header for every
state-mutating request (POST, PUT, PATCH, DELETE).

## How It Works

1. **Obtain the token** — call `GET /v1/csrf/token`. The response sets a
   cookie and returns `{ "csrfToken": "<token>" }`.
2. **Include the header** — on every mutating request, set
   `x-csrf-token: <token>` where `<token>` is the value from the cookie.
3. **Cookie lifecycle** — the cookie is `SameSite=Strict` and *not* `HttpOnly`
   so your JavaScript can read it. In production the cookie name is
   `__Host-csrf` (requires HTTPS); in development it falls back to
   `csrf-token` so local HTTP works.

## Environment-Aware Cookie

| Environment   | Cookie Name    | `Secure` Flag | `__Host-` Prefix |
|---------------|----------------|---------------|------------------|
| `production`  | `__Host-csrf`  | `true`        | Yes              |
| `development` | `csrf-token`   | `false`       | No               |

The `__Host-` prefix tells the browser the cookie must only be sent over HTTPS
and must have `Path=/`. This prevents sub-domain hijacking in production. Local
development over plain HTTP uses a simpler cookie name.

## SPA (React / Next.js) Example

```ts
// On app boot or after login, fetch a CSRF token:
const res = await fetch('/v1/csrf/token', { credentials: 'include' });
const { csrfToken } = await res.json();

// For every mutating request, include the header:
await fetch('/v1/posts', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken,
  },
  body: JSON.stringify({ title: 'Hello' }),
});
```

## Mobile / Bearer-Only Clients

Mobile apps and other non-browser clients that authenticate exclusively via
`Authorization: Bearer <jwt>` are **automatically exempt** from CSRF checks.
The middleware detects the Bearer header and skips validation.

If your mobile app uses cookie-based auth (e.g. a WebView), you must follow the
same flow as SPAs above.

## Webhook Routes

Webhook endpoints (`/v1/webhook/**`) are excluded from CSRF protection. They
authenticate incoming requests using HMAC-SHA256 signature verification via the
`WebhookGuard`, which is a separate authentication mechanism.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `403 Invalid or missing CSRF token` | Missing `x-csrf-token` header | Fetch token from `GET /v1/csrf/token` first |
| Cookie not set on `localhost` | Using `__Host-` prefix over HTTP | Ensure `NODE_ENV` is not `production` locally |
| Cookie rejected by browser | Mixed-content or wrong `SameSite` | Serve frontend and API from the same origin |
