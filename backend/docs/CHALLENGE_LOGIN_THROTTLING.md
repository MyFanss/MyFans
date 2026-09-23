# Challenge / Login Throttling Hardening

## Problem

`POST /auth/login`, `POST /auth/challenge` and `POST /auth/challenge/verify`
currently share the generic `auth` throttle bucket
(`@Throttle({ auth: { limit: 5, ttl: 60000 } })`, see
`src/auth/auth.controller.ts`). That budget is shared with other auth-bucket
routes and is loose enough that repeated challenge issuance or login
attempts can drive meaningful DB + crypto-verification load (resource
exhaustion), especially since challenge generation and signature
verification are not cheap.

## Solution added here

`src/auth/challenge-login-throttler.guard.ts` — a dedicated guard
(`ChallengeLoginThrottlerGuard`) with its own tracker key
(`challenge-login:<ip>`) and a stricter limit constant
(`CHALLENGE_LOGIN_THROTTLE`: 3 requests / 60s), separate from the shared
`auth` bucket so it can't be exhausted by traffic to unrelated auth routes.

Tests: `src/auth/challenge-login-throttler.guard.spec.ts`.

## Wiring in (not applied — additive-only change per request)

```ts
import { UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ChallengeLoginThrottlerGuard,
  CHALLENGE_LOGIN_THROTTLE,
} from './challenge-login-throttler.guard';

@Post('login')
@UseGuards(ChallengeLoginThrottlerGuard)
@Throttle(CHALLENGE_LOGIN_THROTTLE)
async login(@Body() dto: LoginBodyDto) { ... }
```

Apply the same decorators to `challenge` and `challenge/verify`. Consider
lowering `challenge/verify`'s limit further (e.g. 3/60s stays, or drop to
2/60s) since a verify request implies a prior challenge was already issued
and doesn't need as generous a retry budget.

## Follow-up

- Confirm the throttler storage backend (in-memory vs Redis) matches
  production scale-out — a per-instance in-memory tracker under-throttles
  behind a multi-instance load balancer.
