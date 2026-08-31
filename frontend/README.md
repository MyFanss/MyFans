# MyFans Frontend

Next.js app for MyFans: creator/fan UI, Stellar wallet connection
(Freighter and others), and subscription/content flows.

## Quickstart

New to the frontend, or need to connect Freighter against your local API?
See **[docs/LOCAL_QUICKSTART.md](./docs/LOCAL_QUICKSTART.md)** — a
step-by-step local setup + Freighter connection walkthrough (~15 minutes),
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
