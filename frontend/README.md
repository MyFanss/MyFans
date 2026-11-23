# MyFans Frontend

Next.js app for MyFans: creator/fan UI, Stellar wallet connection
(Freighter and others), and subscription/content flows.

## Quickstart

New to the frontend, or need to connect Freighter against your local API?
See **[docs/LOCAL_QUICKSTART.md](./docs/LOCAL_QUICKSTART.md)** — a
step-by-step local setup + Freighter connection walkthrough (~15 minutes, or
~20 to also deploy contracts on a local sandbox and go end-to-end),
including a troubleshooting section for common wallet/CORS/CSP issues.

Short version:

```bash
cd frontend
cp .env.example .env.local   # fill in contract IDs if you have a local deployment
npm ci
npm run dev
```

The app expects the backend on `http://localhost:3001` by default
(`NEXT_PUBLIC_API_URL` in `.env.example`); Next.js proxies same-origin
`/api/v1/*` calls to it (see `next.config.ts`).

## Wallet support

**Freighter is the reference wallet** — the local quickstart is Freighter-only
and it's the wallet guaranteed to work end-to-end. Lobstr is wired for connect
and sign, and WalletConnect is behind an off-by-default feature flag. See
**[docs/WALLET_SETUP.md](./docs/WALLET_SETUP.md)** for the support matrix and
signing dispatch order.

## API calls

New pages should call the backend with **`apiFetch` from
[`src/lib/api/client.ts`](./src/lib/api/client.ts)**. It targets the
same-origin `/api/v1/*` path, which the Next.js rewrite in
[`next.config.ts`](./next.config.ts) forwards to the Nest backend's `/v1/*`,
and it automatically attaches the CSRF token (with a retry) for mutating
requests.

The other two client modules — `src/lib/api-client.ts` and
`lib/api-client.ts` — are not for new pages: they use different base URLs
and different CSRF rules, and `lib/api-client.ts` defaults to calling
`http://localhost:3001` directly. Do not call port `3001` from the browser;
always go through the `/api/v1` rewrite via `apiFetch`.

## Scripts

- `npm run dev` — start the Next.js dev server on `:3000`.
- `npm run build` / `npm run start` — production build/serve.
- `npm test` — Vitest unit/integration tests.
- `npm run test:e2e` — Playwright end-to-end tests.
- `npm run lint` — ESLint.
- `npm run storybook` — component storybook on `:6006`.

## Documentation

- [`docs/LOCAL_QUICKSTART.md`](./docs/LOCAL_QUICKSTART.md) — local env +
  Freighter quickstart and troubleshooting.
- [`docs/WALLET_SETUP.md`](./docs/WALLET_SETUP.md) — wallet support matrix
  (Freighter / Lobstr / WalletConnect) and WalletConnect config.
- [`docs/CSP.md`](./docs/CSP.md) — Content-Security-Policy `connect-src`
  host allowlist (API origin + Stellar/Soroban RPC hosts) and how to
  update it when RPC endpoints change.
- [`docs/SECURITY_HEADERS.md`](./docs/SECURITY_HEADERS.md) — full security
  header set.
- [`docs/ANALYTICS.md`](./docs/ANALYTICS.md) — analytics provider config.
- [`docs/PLAYWRIGHT_FLAKE_TRIAGE.md`](./docs/PLAYWRIGHT_FLAKE_TRIAGE.md) —
  triaging flaky e2e tests.
- [`src/components/wallet/README.md`](./src/components/wallet/README.md) —
  wallet connection system (multi-wallet support, auto-reconnect, error
  handling).
- [`ACCESSIBILITY.md`](./ACCESSIBILITY.md) — accessibility conventions.
- [`STAGING_PARITY_CHECKLIST.md`](./STAGING_PARITY_CHECKLIST.md) — staging
  parity checklist.

For the full-stack (contract + backend + frontend) setup, see the
[root README](../README.md).
