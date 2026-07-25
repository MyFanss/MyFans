# Auth Modes — Stellar Bearer vs. Passport JWT

## Overview

The backend currently has two independent auth mechanisms with no stored
link between the identities they produce:

| Mode | Guard | Credential | Identity | Used by |
|------|-------|-----------|----------|---------|
| Stellar bearer | `FanBearerGuard` | `Authorization: Bearer base64(G-address)` | Stellar address (`req.fanAddress`) | Subscription/fan routes |
| Passport JWT | `JwtAuthGuard` | `Authorization: Bearer <JWT>`, `sub` = platform user UUID | Platform user (`req.user`) | Social routes (creators, posts, comments, conversations, ...) |

There is no `users` column or table linking a platform user UUID to a
Stellar wallet address, so a caller authenticated via one mode has no way
to be resolved into the other mode's identity today.

## Bridge, not unification

`HybridFanAuthGuard` (`src/subscriptions/guards/hybrid-fan-auth.guard.ts`)
accepts *either* credential type on the same endpoint and normalizes the
result onto the request:

- Stellar bearer → `req.fanAddress` set, `req.authMode = 'stellar-bearer'`
- Passport JWT → `req.user` set, `req.authMode = 'jwt'`

Handlers that require a resolved Stellar address (e.g. subscription/chain
checks, spending caps) must check `req.authMode === 'stellar-bearer'`
explicitly and reject otherwise — the guard authenticates the request, it
does not fabricate a Stellar address for a JWT-authenticated user. See
`SpendingCapController`'s `requireFanAddress` helper for the pattern.

## Where this applies today

`HybridFanAuthGuard` is wired into `SpendingCapController`. The main
`SubscriptionsController` checkout/lifecycle routes remain on
`FanBearerGuard` only, since they are payment-critical and a broader swap
needs its own verification pass.

## Future work: true unification

Unifying the two identities (one platform user ↔ one or more linked
Stellar addresses) requires a wallet-linking feature: a table associating
`users.id` with verified Stellar addresses, plus a flow for a
JWT-authenticated user to prove ownership of an address (e.g. a signed
challenge, same pattern as `src/auth/wallet-auth.service.ts`). That is out
of scope for this bridge.
