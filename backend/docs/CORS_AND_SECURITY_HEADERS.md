# CORS and Security Headers

This document describes the CORS (Cross-Origin Resource Sharing) and security headers configuration for the MyFans backend.

## Overview

The backend implements secure CORS and response headers to protect against common web vulnerabilities while maintaining flexibility for different environments (development, staging, production).

Security headers are applied in two layers:

1. **[helmet](https://helmetjs.github.io/) (baseline)** — wired in `main.ts` via `app.use(helmet(...))`. Covers `X-DNS-Prefetch-Control`, `X-Frame-Options`, `X-Powered-By` removal, `X-Download-Options`, `X-Permitted-Cross-Domain-Policies`, `Referrer-Policy`, and `X-XSS-Protection` out of the box.
2. **`SecurityHeadersMiddleware` (project-specific overrides)** — applied immediately after helmet. Manages environment-aware CSP, HSTS, and the Cross-Origin-* family (`COEP`, `COOP`, `CORP`) with production vs. development distinctions.

This layered approach means helmet handles the well-known defaults while the custom middleware retains full control over the headers that need per-environment tuning.

## Security Headers

The following security headers are applied to all responses:

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | Dynamic (env-based) | Prevents XSS and data injection attacks |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Enforces HTTPS |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS protection for older browsers |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer information |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` | Restricts browser features |
| `Cross-Origin-Embedder-Policy` | `require-corp` | Isolates browsing context |
| `Cross-Origin-Opener-Policy` | `same-origin` | Prevents cross-origin window access |
| `Cross-Origin-Resource-Policy` | `same-origin` | Restricts resource loading |

### Removed Headers

The following potentially sensitive headers are removed:
- `X-Powered-By`
- `Server`

## CORS Configuration

### Origin Allowlist (`CORS_ORIGINS`)

CORS is driven by an explicit, env-driven origin allowlist. The backend **never reflects an arbitrary `Origin`** — a request is only granted CORS access when its `Origin` exactly matches an entry in the allowlist.

- **Variable**: `CORS_ORIGINS` (comma-separated list of origins)
- **Legacy alias**: `CORS_ALLOWED_ORIGINS` is still read for backwards compatibility; if both are set, `CORS_ORIGINS` wins.
- **Multiple origins**: list every origin you need, including staging and preview-deploy URLs, e.g.
  ```bash
  CORS_ORIGINS=https://myfans.example.com,https://www.myfans.example.com,https://staging.myfans.example.com,https://pr-123.preview.myfans.example.com
  ```
- **Preview deploys**: add each ephemeral preview URL to `CORS_ORIGINS` (or use a wildcard subdomain pattern supported by your deploy tooling). Origins are matched exactly, so a preview URL must be listed before it can call the API.

### Development Mode (`NODE_ENV=development`)

In development, the backend is permissive to facilitate local development:

- **Allowed Origins**: All localhost origins automatically allowed
  - `http://localhost:3000`
  - `http://localhost:3001`
  - `http://localhost:5173`
  - `http://localhost:8080`
  - `http://127.0.0.1:*` (same ports)
- **Custom Origins**: Can be added via `CORS_ORIGINS` environment variable
- **Host Filtering**: Relaxed for `localhost` and `127.0.0.1`

### Production Mode (`NODE_ENV=production`)

In production, the backend is strict:

- **Allowed Origins**: Only origins explicitly listed in `CORS_ORIGINS`
- **Allowed Hosts**: Only hosts explicitly listed in `CORS_ALLOWED_HOSTS`
- **Default Behavior**: If no allowlist is configured, all CORS requests are blocked

#### Boot Guard: wildcard + credentials is rejected

Because `Access-Control-Allow-Credentials: true` is always set, a wildcard origin (`*`) would let **any** site make credentialed cross-origin requests — a serious vulnerability. To prevent this, the application **fails to boot in production** when CORS is configured as wildcard `*` while credentials are enabled:

```
Error: Refusing to start: CORS_ORIGINS='*' cannot be combined with credentials in production.
Set an explicit origin allowlist instead.
```

If you genuinely need a wildcard (e.g. a public, unauthenticated API), you must disable credentials — but for the MyFans SPA the correct fix is always an explicit allowlist.

## Environment Variables

### Backend Environment Variables

Add these to your `backend/.env` file:

```bash
# CORS Configuration
# Comma-separated list of allowed origins (never '*' in production with credentials)
CORS_ORIGINS=https://myfans.example.com,https://www.myfans.example.com

# Comma-separated list of allowed hosts (for additional host-based filtering)
CORS_ALLOWED_HOSTS=myfans.example.com,www.myfans.example.com
```

### Content Security Policy (CSP)

The CSP is automatically adjusted based on environment:

**Development:**
```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src *
```

**Production:**
```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src [CORS_ORIGINS]; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests
```

#### Aligning CSP `connect-src` with the frontend

The production CSP `connect-src` is populated from the same `CORS_ORIGINS` allowlist. This keeps the backend CSP in sync with the hosts the Freighter SPA is allowed to call, as documented in `frontend/docs/SECURITY_HEADERS.md`. When you add a new frontend origin (staging, preview, custom domain), add it to `CORS_ORIGINS` so both CORS and CSP `connect-src` stay aligned.

## CORS Behavior

### Allowed Methods
- `GET`
- `POST`
- `PUT`
- `PATCH`
- `DELETE`
- `OPTIONS` (preflight)

### Allowed Headers
- `Content-Type`
- `Authorization`
- `X-Requested-With`
- `X-Correlation-ID`
- `X-Request-ID`
- `Accept`
- `Origin`

### Exposed Headers
- `X-Correlation-ID`
- `X-Request-ID`
- `Content-Length`
- `Content-Range`

### Credentials
- `Access-Control-Allow-Credentials: true` is always set
- Cookies and authentication headers are allowed in cross-origin requests
- Because credentials are enabled, wildcard `*` origins are rejected in production (see Boot Guard above)

## Testing

### Unit Tests

Run unit tests for the middleware and service:

```bash
cd backend
npm test -- security-headers.middleware.spec.ts
npm test -- cors.service.spec.ts
```

### E2E Tests

Run end-to-end tests to verify CORS and security headers behavior:

```bash
cd backend
npm run test:e2e -- cors-security.e2e-spec.ts
```

### Manual Testing

Test CORS preflight:

```bash
curl -X OPTIONS http://localhost:3000/ \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  -i
```

Check security headers:

```bash
curl -I http://localhost:3000/
```

## Production Deployment Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Configure `CORS_ORIGINS` with your production domains (never `*`)
- [ ] Configure `CORS_ALLOWED_HOSTS` with your production hosts
- [ ] Confirm the app boots (wildcard + credentials is rejected at startup)
- [ ] Verify HSTS header is present
- [ ] Verify CSP is restrictive (no `'unsafe-inline'` for scripts)
- [ ] Verify CSP `connect-src` matches `CORS_ORIGINS` and the frontend `SECURITY_HEADERS.md`
- [ ] Test CORS with production frontend URLs
- [ ] Verify `X-Powered-By` header is removed
- [ ] Run E2E tests in staging environment

## Troubleshooting

### CORS Errors in Browser

**Error**: "No 'Access-Control-Allow-Origin' header is present"

**Solutions**:
1. Ensure the frontend origin is in `CORS_ORIGINS`
2. Check that `NODE_ENV` is set correctly
3. Verify the backend is receiving the `Origin` header
4. Check browser console for the exact error message

### App Fails to Boot in Production

**Error**: `Refusing to start: CORS_ORIGINS='*' cannot be combined with credentials in production.`

**Solutions**:
1. Replace `CORS_ORIGINS=*` with an explicit comma-separated allowlist
2. If a wildcard is truly required, disable credentials (not recommended for the SPA)

### Security Headers Missing

**Issue**: Security headers not appearing in responses

**Solutions**:
1. Ensure `SecurityHeadersMiddleware` is registered in `main.ts`
2. Check that no other middleware is overriding the headers
3. Verify the middleware is applied before route handlers

### CSP Violations

**Error**: Content Security Policy blocking legitimate resources

**Solutions**:
1. Review CSP violation reports in browser console
2. Adjust CSP directives in `security-headers.middleware.ts`
3. Add the missing origin to `CORS_ORIGINS` so `connect-src` includes it
4. Consider using CSP reporting endpoint for monitoring
5. Test changes in development before production

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Incoming Request                      │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              CORS Middleware (NestJS built-in)           │
│  - Origin allowlist validation (CORS_ORIGINS)            │
│  - Preflight handling                                    │
│  - CORS headers                                          │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│         Security Headers Middleware (Custom)             │
│  - CSP, HSTS, X-Frame-Options, etc.                      │
│  - Remove sensitive headers                              │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│         Correlation ID Middleware (Custom)               │
│  - Generate/propagate correlation IDs                    │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Logging Middleware (Custom)                 │
│  - Request/response logging                              │
└─────────────────────────────────────────────────────────┘
```
