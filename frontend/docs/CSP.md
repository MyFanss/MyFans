# Content-Security-Policy: connect-src hosts

> **Header ownership across layers:** this document covers the frontend
> `connect-src` directive only. For the full picture of which layer sets
> which security header (backend Helmet, frontend Next CSP, wallet
> extensions, edge/preview), see
> [`docs/SECURITY_HEADERS_MATRIX.md`](./SECURITY_HEADERS_MATRIX.md).

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

## Wallet extension origins

Browser wallet extensions (Freighter, Lobstr, Rabet, …) inject their bridge
into the page and communicate with the extension's own origin. That traffic
is **not** subject to the page's `connect-src` — extension messaging goes
through the injected provider / `window.postMessage`, not `fetch`/`WebSocket`
from the page — so no extension origin needs to be listed in `connect-src`.
The extension's own background context performs the network calls to Horizon
and Soroban RPC, and those are governed by the extension's own permissions,
not this app's CSP.

What the app **does** need for Freighter to work is:

- The Horizon / Soroban RPC hosts the extension will be asked to talk to
  must be reachable from the page when the app itself reads chain state
  (covered by items 1–3 above).
- The cross-origin isolation headers must be relaxed on wallet-heavy routes
  (see *COEP / CORP and wallet extensions* below).

Do **not** add extension origins (e.g. `chrome-extension://…`) to
`connect-src`. They are unnecessary and would widen the policy without
benefit. If a wallet integration genuinely needs a page-initiated network
call to a wallet vendor host, add that host explicitly via the env-driven
mechanism below rather than a wildcard.

## WalletConnect relays (only when the feature flag is on)

WalletConnect (Sign Client) is **off by default** and gated behind a feature
flag. When it is disabled, the app makes no WalletConnect calls and the
`connect-src` policy does **not** need any WalletConnect relay hosts — the
policy above is complete and nothing extra is added.

When WalletConnect is **enabled** (flag on **and** a project id configured),
the Sign Client opens a WebSocket to the WalletConnect relay and the browser
will block it unless the relay host is in `connect-src`. The relay hosts are
added to `connect-src` **only** in that enabled case, so a default/off build
never widens the policy:

- `wss://relay.walletconnect.com`
- `wss://relay.walletconnect.org`
- `https://verify.walletconnect.com` (attestation / verify API)

These are added by `buildConnectSrcHosts()` in `src/lib/csp.ts` when the
WalletConnect feature flag is enabled and a project id is present. If the
flag is on but the project id is missing, the app surfaces a clear
configuration error instead of silently attempting a relay connection that
CSP would block anyway.

**Enabling WalletConnect therefore requires a CSP change in the same
deploy** — flip the flag, set the project id, and confirm the relay hosts
above appear in the served `Content-Security-Policy` header. See
`docs/WALLET_SETUP.md` for the full enable steps and
`STAGING_PARITY_CHECKLIST.md` for the staging verification checklist.

## No wildcards in production

Production `connect-src` must never contain a bare wildcard (`*`) or a
scheme-only wildcard (`https:`, `wss:`). Every entry is either an explicit
host, a scoped subdomain wildcard that is part of the reviewed default set
(`*.stellar.org`), or a host derived from an explicit env var. This keeps
XSS containment meaningful: a compromised script can only exfiltrate to the
small, reviewed set of hosts the app legitimately talks to.

If you find yourself wanting `connect-src *` to "make something work", the
correct fix is to add the specific host via `NEXT_PUBLIC_SOROBAN_RPC_URL` /
`NEXT_PUBLIC_HORIZON_URL` (or to `DEFAULT_STELLAR_CONNECT_HOSTS` if it's a
new Stellar default), not to widen the policy.

## Report-URI (optional)

A `report-uri` / `report-to` directive can be added to the CSP to collect
violation reports. It is **optional** and off unless a reporting endpoint is
configured; when set, it must point at a first-party collector. Reporting is
observability only — it does not relax any directive, and a missing or
unreachable report endpoint must never cause the policy itself to fail open.

## Updating the host list

- **Adding a new default Stellar/Soroban host** (e.g. Stellar ships a new
  network or RPC provider): add it to `DEFAULT_STELLAR_CONNECT_HOSTS` in
  `src/lib/csp.ts`.
- **Using a custom/private RPC or Horizon endpoint**: set
  `NEXT_PUBLIC_SOROBAN_RPC_URL` and/or `NEXT_PUBLIC_HORIZON_URL` in your env
  (see `.env.example`) — no code change needed, the host is picked up
  automatically.
- **Enabling WalletConnect**: set the feature flag and project id (see
  `docs/WALLET_SETUP.md`); the relay hosts are added to `connect-src`
  automatically when the flag is on. Do not add relay hosts manually for a
  flag-off build.
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
- `localhost` / `127.0.0.1` are present in local dev and absent in
  preview/staging/production.

## Related documents

- [`docs/SECURITY_HEADERS_MATRIX.md`](./SECURITY_HEADERS_MATRIX.md) — single
  source of truth for which layer (backend Helmet, frontend Next CSP,
  wallet extensions, edge/preview) sets which security header, with
  per-environment examples and verification steps.
- [`docs/WALLET_SETUP.md`](./WALLET_SETUP.md) — wallet enable steps,
  including the WalletConnect flag/project-id flow referenced above.
- `backend/docs/CORS_AND_SECURITY_HEADERS.md` — backend Helmet/CORS header
  ownership and configuration.
