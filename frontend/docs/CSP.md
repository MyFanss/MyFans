# Content-Security-Policy: connect-src hosts

The `Content-Security-Policy` header is built in `next.config.ts` via
`buildContentSecurityPolicy()` (`src/lib/csp.ts`). This document covers the
`connect-src` directive specifically, since it's the one that controls which
hosts the app (and connected wallets like Freighter) are allowed to talk to.

## What's allowed

`connect-src` is built from `buildConnectSrcHosts()` and always includes:

1. **The app's own API origin** — the host portion of `getApiBaseUrl()`
   (`NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:3001`).
2. **Default Stellar/Soroban hosts** (`DEFAULT_STELLAR_CONNECT_HOSTS` in
   `src/lib/csp.ts`):
   - `*.stellar.org`
   - `mainnet.sorobanrpc.com`
   - `rpc-futurenet.stellar.org`
   - `soroban-testnet.stellar.org`
   - `horizon-testnet.stellar.org`
   - `horizon-futurenet.stellar.org`
3. **Whatever RPC hosts are actually configured**, extracted from:
   - `NEXT_PUBLIC_SOROBAN_RPC_URL`
   - `NEXT_PUBLIC_HORIZON_URL`

   This matters when the app is pointed at a non-default RPC — a private
   Soroban RPC endpoint, a different testnet provider, a self-hosted Horizon
   instance, etc. Without step 3, CSP would silently block those calls even
   though `contract-config.ts` is configured to use them, and wallet
   signing/submission would fail with an opaque CSP violation in the
   console instead of a clear error.
4. In **local dev only**: `localhost:*` and `127.0.0.1:*`, so local backends
   and local RPC nodes work without any extra configuration. This is gated
   by `shouldAllowLocalhost()` — it is dropped for a production build **and**
   for any deployed environment that identifies itself via
   `NEXT_PUBLIC_APP_ENV` / `VERCEL_ENV` as `preview`, `staging`, or
   `production`, even if that build was made with `NODE_ENV !== 'production'`.
   A preview URL therefore never ships a policy that trusts `localhost`.

Everything else is blocked. A host that isn't the API origin, isn't in
`DEFAULT_STELLAR_CONNECT_HOSTS`, and isn't reachable via
`NEXT_PUBLIC_SOROBAN_RPC_URL` / `NEXT_PUBLIC_HORIZON_URL` will **not** be
added automatically — this is intentional, so a compromised or unexpected
host can't sneak into the policy.

## Updating the host list

- **Adding a new default Stellar/Soroban host** (e.g. Stellar ships a new
  network or RPC provider): add it to `DEFAULT_STELLAR_CONNECT_HOSTS` in
  `src/lib/csp.ts`.
- **Using a custom/private RPC or Horizon endpoint**: set
  `NEXT_PUBLIC_SOROBAN_RPC_URL` and/or `NEXT_PUBLIC_HORIZON_URL` in your env
  (see `.env.example`) — no code change needed, the host is picked up
  automatically.
- **Verifying nothing regressed**: run the CSP regression test in
  `src/lib/csp.test.ts` (`npm test -- csp`). It asserts the default Stellar
  hosts are always present and that a configured RPC/Horizon host is added,
  so an accidental deletion of a host from `DEFAULT_STELLAR_CONNECT_HOSTS`
  or a change to `buildConnectSrcHosts()` that drops env-configured hosts
  fails CI instead of shipping a broken wallet connection.

## Regression test

`src/lib/csp.test.ts` is a CI regression test for `connect-src`. It exists
because CSP is easy to break silently — a refactor of `next.config.ts` or
`src/lib/csp.ts` can drop a Stellar host and nothing fails locally; it only
shows up later as a wallet extension throwing CSP violations in production.

What it asserts:

- Every host in `DEFAULT_STELLAR_CONNECT_HOSTS` (`*.stellar.org`,
  `mainnet.sorobanrpc.com`, `rpc-futurenet.stellar.org`,
  `soroban-testnet.stellar.org`, `horizon-testnet.stellar.org`,
  `horizon-futurenet.stellar.org`) is present in `connect-src`.
- The API origin host is present.
- A host configured via `NEXT_PUBLIC_SOROBAN_RPC_URL` /
  `NEXT_PUBLIC_HORIZON_URL` is added and deduped against the defaults.
- Hosts that aren't the API origin, a default Stellar host, or an
  env-configured RPC/Horizon host are **not** added.
- `localhost:*` / `127.0.0.1:*` only appear outside production.

Run it directly with `npm test -- csp` (or `npm test` for the full suite).

**When you need to update the host list**, edit
`DEFAULT_STELLAR_CONNECT_HOSTS` in `src/lib/csp.ts` and update the
corresponding assertions/list in `src/lib/csp.test.ts` and the "What's
allowed" section above in the same change — the test is intentionally
written to fail if the two drift apart, so a host removal must be a
deliberate, reviewed edit in both places, not an accidental side effect of
an unrelated refactor.

## Preview / staging environments

Preview and staging are treated as **deployed** environments, not dev:

- They must set `NEXT_PUBLIC_APP_ENV` (`preview` / `staging`) — this alone
  drops `localhost:*` from `connect-src` regardless of `NODE_ENV`.
- Their `connect-src` is still built purely from *their own*
  `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOROBAN_RPC_URL`, and
  `NEXT_PUBLIC_HORIZON_URL` — a preview pointed at a preview API/RPC only
  allows those hosts, and nothing leaks in from production defaults.
- Keep the CSP env vars in the deploy config in sync with
  `STAGING_PARITY_CHECKLIST.md` → *Networking & API*.

## COEP / CORP and wallet extensions

`connect-src` is only half of what wallet extensions (Freighter, Lobstr,
…) need. The cross-origin isolation headers (`Cross-Origin-Embedder-Policy`,
`Cross-Origin-Resource-Policy`, `Cross-Origin-Opener-Policy`) also have to
be relaxed on wallet-heavy routes or the extension cannot inject its
bridge. That policy — route-scoped `credentialless` COEP on
`/checkout`, `/subscribe`, `/wallet-demo` and `require-corp` elsewhere — is
documented in `docs/SECURITY_HEADERS.md`. Changing either file without the
other tends to break Freighter connect, so review them together.

## Related

- `src/lib/csp.ts` — host + CSP string construction, unit-tested directly.
- `src/lib/csp.test.ts` — regression test guarding wallet connect-src hosts.
- `src/lib/contract-config.ts` — resolves `sorobanRpcUrl` / `horizonUrl` per
  network; keep `NETWORK_DEFAULTS` there in sync with
  `DEFAULT_STELLAR_CONNECT_HOSTS`.
- `docs/SECURITY_HEADERS.md` — the rest of the security header set.
