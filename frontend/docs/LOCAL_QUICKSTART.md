# Frontend local quickstart + Freighter setup

Get the frontend running locally against the local API and connect
Freighter to it. Written to be followed top-to-bottom in under 15 minutes.

## 1. Prerequisites (2 min)

- Node.js (see root `package.json`/`.nvmrc` if present) and `npm`.
- The backend running locally on `:3001` — from repo root:
  ```bash
  cd backend && npm ci && npm run start:dev
  # or from repo root: ./scripts/myfans dev:backend
  ```
- The [Freighter](https://freighter.app) browser extension installed, with
  a wallet created/imported and unlocked.

## 2. Configure the environment (2 min)

```bash
cd frontend
cp .env.example .env.local
```

Defaults in `.env.example` point at a local backend (`http://localhost:3001`)
and Stellar **testnet**, which is what Freighter should also be set to (see
step 4).

### Contract IDs

The `NEXT_PUBLIC_*_CONTRACT_ID` values in `.env.example` are left empty. The
UI still loads without them, but any flow that builds a Soroban transaction
(e.g. subscribe, gated content) will throw **only at click time**, because
`validateRuntimeContractConfig` (in `src/lib/contract-config.ts`) is checked
at runtime. So before exercising on-chain flows, record real contract IDs:

- **Deployed (recommended):** run the testnet deploy to generate
  `contract/.env.deployed-testnet`, then copy the five `NEXT_PUBLIC_*_CONTRACT_ID`
  values into `.env.local`. See
  [`contract/docs/CONTRACT_DEPLOY_RUNBOOK.md`](../../contract/docs/CONTRACT_DEPLOY_RUNBOOK.md)
  and [`contract/docs/DEPLOYED_ENV.md`](../../contract/docs/DEPLOYED_ENV.md).
- **Local-only setup (this quickstart):** the backend runs on a local DB with
  mocked/startup-probe stubs and no live on-chain reads; for the UI to be fully
  functional you still want testnet IDs from the deploy step above. If you are
  only exploring the API/UI shell and not submitting transactions, leaving the
  IDs empty is fine.

> The `.env.example` defaults are for **local development only**. Real deployments
> should get IDs from a real testnet/mainnet deploy — never invent or hard-code
> placeholder IDs for production.

## 3. Install and run (3 min)

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. The app talks to the backend through Next's
same-origin `/api/v1/*` proxy (configured in `next.config.ts`), so you
should **not** need to touch CORS for normal API calls.

## 4. Connect Freighter (5 min)

1. Open the Freighter extension and switch its network to match
   `NEXT_PUBLIC_STELLAR_NETWORK` in `.env.local` (default: **Test Net**).
   Settings → Preferences → Network in the extension.
2. In the app, open the wallet connect flow (e.g. `/wallet-demo`, or the
   "Connect wallet" button in the nav) and choose **Freighter**.
3. Approve the connection request in the Freighter popup.
4. You should land back in the app with a connected address shown. If
   nothing happens, see Troubleshooting below before retrying.

## 5. Smoke test (3 min)

- [ ] `npm run dev` starts without errors and `/` loads.
- [ ] A page that hits the API (e.g. `/discover` or `/feed`) renders data
      instead of an error state — confirms the API proxy/backend is reachable.
- [ ] Freighter connects and shows an address (step 4).
- [ ] No `Content-Security-Policy` violations appear in the browser
      console when connecting the wallet (see `docs/CSP.md` if you do).

If all four pass, your local setup is good to go.

## Troubleshooting

### Freighter isn't detected / "install wallet" prompt shown

- Make sure the extension is enabled for the current browser profile and
  the tab was loaded (or reloaded) **after** installing it.
- Freighter injects its API into `window` on page load — a hot-reloaded
  page sometimes misses it; do a hard refresh.

### Freighter connects but transactions fail with a network mismatch

- The wallet's selected network (Test Net / Public Net / Futurenet) must
  match `NEXT_PUBLIC_STELLAR_NETWORK`. Mismatches typically show up as a
  signing error or an invalid-transaction response from Horizon/Soroban
  RPC rather than an obvious "wrong network" message.

### Wallet calls fail with a CSP / "Refused to connect" console error

- This means the RPC/Horizon host Freighter (or the app) is calling isn't
  in the CSP `connect-src` allowlist. If you've set a custom
  `NEXT_PUBLIC_SOROBAN_RPC_URL` or `NEXT_PUBLIC_HORIZON_URL`, restart
  `npm run dev` after editing `.env.local` — Next only reads env at server
  start. See `docs/CSP.md` for exactly which hosts are allowed and how to
  add one.

### API calls fail with a CORS error in the console

- Requests made through the app's own fetch calls should go through
  `/api/v1/*`, which Next rewrites server-side (no CORS involved). A CORS
  error usually means either:
  - The backend isn't running / isn't on the port `NEXT_PUBLIC_API_URL`
    points at (default `http://localhost:3001`) — check the backend
    terminal for startup errors.
  - Some code is calling the backend origin directly (bypassing the
    `/api/v1` proxy) — check the backend's CORS allowlist
    (`backend/src/common/services/cors.service.ts`) includes
    `http://localhost:3000`.

### `.env.local` changes don't seem to take effect

- Restart `npm run dev`. Next.js only reads `NEXT_PUBLIC_*` env vars at
  build/server start, not on hot reload.

## Related docs

- [`docs/CSP.md`](./CSP.md) — CSP `connect-src` host allowlist and how
  wallet/RPC hosts get added to it.
- [`src/components/wallet/README.md`](../src/components/wallet/README.md) —
  wallet connection system internals (multi-wallet support, reconnection,
  error handling).
- Root [`README.md`](../../README.md) — full-stack setup (contract +
  backend + frontend together).
