# CORS and Security Headers

This document describes how the backend sets CORS and security headers via
Helmet, and how those headers interact with the frontend (Next.js CSP) and
wallet browser extensions.

> **Single source of truth:** the cross-layer ownership matrix, per-environment
examples, wallet extension caveats, and verification steps now live in
[`docs/SECURITY_HEADERS_MATRIX.md`](../../docs/SECURITY_HEADERS_MATRIX.md).
> This file focuses on the backend (Helmet) layer only.

## Backend (Helmet)

The API applies security headers with [Helmet](https://helmetjs.github.io/).
Helmet sets a conservative default set of response headers on every API
response:

| Header | Default | Notes |
| --- | --- | --- |
| `Content-Security-Policy` | `default-src 'self'` | API responses are JSON; the API does not serve HTML. |
| `Strict-Transport-Security` | `max-age=15552000; includeSubDomains` | Only meaningful over HTTPS. |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing. |
| `X-Frame-Options` | `SAMEORIGIN` | API responses must not be framed. |
| `Referrer-Policy` | `no-referrer` | |
| `Cross-Origin-Opener-Policy` | `same-origin` | |
| `Cross-Origin-Resource-Policy` | `same-origin` | |
| `X-DNS-Prefetch-Control` | `off` | |
| `X-Download-Options` | `noopen` | |
| `X-Permitted-Cross-Domain-Policies` | `none` | |
| `X-XSS-Protection` | `0` | Disabled; rely on CSP instead. |

`Permissions-Policy` is not set by Helmet by default and is configured
explicitly where required.

### CORS

CORS is configured separately from Helmet. The allowed origins are driven by
environment configuration (see `CORS_ORIGINS`). Credentials are only allowed
for explicitly listed origins; wildcard origins are never combined with
`Access-Control-Allow-Credentials: true`.

## Frontend (Next.js CSP)

The frontend owns the document-level CSP and related headers for HTML
responses. See [`frontend/docs/CSP.md`](../../frontend/docs/CSP.md) for the
Next.js configuration, nonce handling, and `unsafe-inline` policy.

## Wallet extensions

Wallet browser extensions inject content scripts and open extension-origin
frames. They are sensitive to `connect-src`, `frame-ancestors`, and the
COOP/COEP/CORP family. Requirements and caveats are documented in the matrix
doc.

## Related documents

- [`docs/SECURITY_HEADERS_MATRIX.md`](../../docs/SECURITY_HEADERS_MATRIX.md) — cross-layer ownership matrix, per-env examples, wallet caveats, verification.
- [`frontend/docs/CSP.md`](../../frontend/docs/CSP.md) — Next.js CSP configuration.
