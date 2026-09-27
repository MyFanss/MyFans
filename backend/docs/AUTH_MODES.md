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

## Wallet Linking (true unification)

A JWT-authenticated user can now link verified Stellar addresses to their
account via the wallet-linking flow:

1. **Create Challenge**: `POST /v1/auth/wallet/challenge`
   - Request: `{ "stellarAddress": "G..." }`
   - Response: `{ "nonce": "...", "expiresAt": "..." }`
   - Challenge expires in 5 minutes and is single-use

2. **Verify and Link**: `POST /v1/auth/wallet/verify` (requires JWT token)
   - Request: `{ "stellarAddress": "G...", "nonce": "...", "signature": "..." }`
   - Response: `{ "id": "...", "stellarAddress": "...", "verifiedAt": "..." }`
   - Signature is Ed25519(nonce) from the wallet keypair
   - Linked address must be unique across all users; linking an already-linked
     address to a different user returns 409 Conflict
   - First linked address becomes primary; subsequent links can be managed
     via `GET /v1/auth/wallet/links` and `DELETE /v1/auth/wallet/links/:linkId`

### Persistence

Wallet links are stored in the `user_wallet_links` table:
- `id` (PK, UUID)
- `user_id` (FK to users)
- `stellar_address` (unique, required)
- `is_primary` (boolean, used by gating/notifications)
- `verified_at` (timestamp)
- `created_at` (timestamp)

### Usage in Content Gating

Services requiring a Stellar address for gating can now:

```typescript
const primaryLink = await walletLinkingService.getPrimaryWalletLink(userId);
if (primaryLink) {
  // Use primaryLink.stellarAddress for chain queries, spending caps, etc.
}
```

## Sign-in: canonical challenge-login endpoints only

The sign-in surface must use **only** the canonical challenge-login
endpoints. There is no password form and no register endpoint on this
surface — the deprecated register copy that pointed contributors at dead
APIs has been removed.

### Canonical endpoints

1. **Issue Challenge**: `POST /v1/auth/challenge`
   - Request: `{ "stellarAddress": "G..." }`
   - Response: `{ "nonce": "...", "expiresAt": "..." }`
   - Challenge is single-use and short-lived

2. **Verify Challenge**: `POST /v1/auth/challenge/verify`
   - Request: `{ "stellarAddress": "G...", "nonce": "...", "signature": "..." }`
   - Response: `{ "token": "...", "stellarAddress": "..." }`
   - Signature is Ed25519(nonce) produced by the wallet keypair

These are the only endpoints the sign-in page may call. Do **not** call
`/v1/auth/register` or any other deprecated register endpoint.

### Freighter flow (honest path)

1. Request a challenge from `POST /v1/auth/challenge`.
2. Ask Freighter to sign the returned nonce with the user's keypair.
3. Submit the signed challenge to `POST /v1/auth/challenge/verify`.

If the user dismisses the Freighter prompt, treat it as a **non-error user
state** (e.g. "Sign-in cancelled") — do not surface it as a failure.

### Error map

| Condition | UX |
|-----------|----|
| Wallet cancel (user dismissed Freighter) | Non-error state: "Sign-in cancelled" |
| HTTP 429 (throttled) | "Too many attempts — please wait a moment and try again." |
| Challenge expired / invalid nonce | Prompt to retry sign-in from the start |
| Signature verification failure | "Could not verify signature — please try again." |

### Security considerations

- No password forms: password auth is unsupported on this surface.
- Challenges are single-use and expire; never reuse a nonce.
- Never log or persist the raw signature beyond verification.

### Deprecation Note

The deprecated `src/auth/wallet-auth.service.ts` (in the dead `src/auth/` module)
is superseded by `src/auth-module/services/wallet-linking.service.ts`. The legacy
service can be removed once this wallet-linking flow is confirmed working in
production.
