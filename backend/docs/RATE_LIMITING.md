# API Rate Limiting

This document describes the rate limiting strategy implemented for the MyFans API.

## Overview

Rate limiting is enforced globally using `@nestjs/throttler` to protect against abuse, brute-force attacks, and ensure fair usage across all API endpoints.

## Rate Limit Tiers

| Tier | Limit | TTL | Use Case |
|------|-------|-----|----------|
| `short` | 10 requests | 60 seconds | Default short window |
| `medium` | 50 requests | 60 seconds | Authenticated user operations |
| `long` | 100 requests | 60 seconds | General API endpoints (default) |
| `auth` | 5 requests | 60 seconds | Login/register (strict) |
| Exempt | Unlimited | N/A | Basic liveness endpoint only |

## Route Classes

Routes are grouped into three classes so that limits match the cost and risk of
each operation:

| Class | Tier | Limit | Applies to |
|-------|------|-------|------------|
| Auth (strict) | `auth` | 5 req/min | `POST /v1/auth/login`, `POST /v1/auth/register`, and other auth challenge endpoints |
| Read (loose) | `long` | 100 req/min | Public read endpoints such as creator and plan listings |
| Upload (strict) | `short` | 10 req/min | Upload and other write-heavy endpoints |

## Endpoint Categories

### Health Check Endpoints (Exempt)
Only the inexpensive liveness endpoint is exempt from rate limiting:
- `GET /v1/health` - Basic health check

Dependency and diagnostic health endpoints remain rate limited because they
perform external or comparatively expensive work.

### Authentication Endpoints (Strict)
Rate limited to prevent brute-force attacks:
- `POST /v1/auth/login` - 5 requests per minute
- `POST /v1/auth/register` - 5 requests per minute

### Public Endpoints (Read, Loose)
Rate limited to prevent abuse while allowing public access:
- `GET /v1/creators` - Search creators: 100 requests per minute
- `GET /v1/creators/plans` - List all plans: 100 requests per minute
- `GET /v1/creators/:address/plans` - List creator plans: 100 requests per minute

### Upload Endpoints (Strict)
Rate limited to protect write-heavy operations:
- Upload endpoints - 10 requests per minute

### All Other Endpoints
Default rate limit of 100 requests per minute applies.

## Response Headers

When a request is rate limited, the following headers are included in the response:

```
Retry-After: <seconds>
X-RateLimit-Limit: <limit>
X-RateLimit-Remaining: <remaining>
X-RateLimit-Reset: <timestamp>
```

## Rate Limited Response (429 Too Many Requests)

When a client exceeds the rate limit, they will receive a `429 Too Many Requests` response:

```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

## Implementation Details

### Configuration

Rate limiting is configured in `backend/src/app.module.ts`:

```typescript
ThrottlerModule.forRoot([
  { name: 'auth', ttl: 60000, limit: 5 },
  { name: 'short', ttl: 60000, limit: 10 },
  { name: 'medium', ttl: 60000, limit: 50 },
  { name: 'long', ttl: 60000, limit: 100 },
]),
```

### Custom Throttler Guard

A custom `ThrottlerGuard` (`backend/src/common/guards/throttler.guard.ts`) extends the NestJS throttler to:
- Exempt health check endpoints from rate limiting
- Apply appropriate rate limits based on route

### Per-Route Configuration

Individual routes can be configured using the `@Throttle()` decorator:

```typescript
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  @Post('login')
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  async login(@Body() body: { address?: string }) {
    // ...
  }
}
```

## Security Headers

The API also sets security headers on all responses:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

## Modifying Rate Limits

To adjust rate limits:

1. **Global limits**: Edit `ThrottlerModule.forRoot()` in `backend/src/app.module.ts`
2. **Per-route limits**: Add or modify `@Throttle()` decorators on controller methods
3. **New exempt routes**: Update `ThrottlerGuard` in `backend/src/common/guards/throttler.guard.ts`

## Distributed Rate Limiting (Production)

The default implementation uses in-memory rate limiting, which only works for
single-instance deployments. Each instance keeps its own counters, so a client
can multiply its effective quota by the number of running instances.

**Redis is required before scaling horizontally.** Any multi-instance or
HA deployment MUST configure `REDIS_URL` so all instances share a single
throttler store. When `REDIS_URL` is set, the throttler uses a Redis-backed
store; when it is unset, it falls back to the in-memory store (single-instance
only).

```typescript
// Install: npm install @nestjs/throttler ioredis
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';

const storage = process.env.REDIS_URL
  ? new ThrottlerStorageRedisService(process.env.REDIS_URL)
  : undefined; // in-memory fallback for single-instance deployments

ThrottlerModule.forRoot({
  throttlers: [
    { name: 'auth', ttl: 60000, limit: 5 },
    { name: 'short', ttl: 60000, limit: 10 },
    { name: 'medium', ttl: 60000, limit: 50 },
    { name: 'long', ttl: 60000, limit: 100 },
  ],
  storage,
}),
```

### Deployment Checklist for HA

- [ ] Set `REDIS_URL` on every API instance
- [ ] Verify all instances point at the same Redis database
- [ ] Confirm counters are shared (a burst across instances is throttled once)
- [ ] Never disable throttling in production via a query parameter

## Testing

Rate limiting is tested in `backend/src/common/guards/throttler.guard.spec.ts`
and end-to-end in `backend/test/rate-limit.e2e-spec.ts`.

Run tests:
```bash
cd backend
npm test -- throttler.guard.spec.ts
npm run test:e2e -- rate-limit.e2e-spec.ts
```

## Security Checklist

### Rate Limiting & DDoS Protection
- [x] Implement rate limiting per user/IP
- [x] Add stricter limits for auth endpoints (5 req/min)
- [x] Configure request quotas per endpoint type
- [x] Handle rate limit errors gracefully (429 response)
- [x] Return proper rate limit headers
- [ ] Use Redis for distributed rate limiting (required for HA / multi-instance)

### Security Headers
- [x] X-Content-Type-Options: nosniff
- [x] X-Frame-Options: DENY
- [x] X-XSS-Protection enabled
- [x] HSTS header configured
- [ ] Content Security Policy (CSP) - future enhancement
- [ ] Referrer-Policy - future enhancement

### Monitoring & Logging
- [ ] Log security events (rate limit violations)
- [ ] Monitor for suspicious activity
- [ ] Set up alerts for repeated violations
- [ ] Track API usage patterns

## References

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [@nestjs/throttler Documentation](https://docs.nestjs.com/security/rate-limiting)
- [Express Rate Limiting Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
