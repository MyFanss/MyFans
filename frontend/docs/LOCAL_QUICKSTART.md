# Frontend local quickstart + Freighter setup

Get the frontend running locally against the local API and connect
**Freighter** to it, then take the flow end-to-end (contracts on a local
sandbox → create a plan → subscribe). Written to be followed top-to-bottom in
around 20 minutes.

> **Wallet support today.** This guide is deliberately **Freighter-first** —
> Freighter is the reference wallet and the only one guaranteed to work
> through every step below. Lobstr is wired for connect + sign but is less
> battle-tested, and WalletConnect is behind an off-by-default feature flag.
> See [WALLET_SETUP.md](./WALLET_SETUP.md) for the full support matrix and how
> signing is dispatched.

## 1. Clone the repo (2 min)

From a terminal:

```bash
git clone <your-fork-or-remote-url> && cd <repo-dir>
npm run install:all   # installs backend, frontend, and contract deps
```

Requirements: Node.js (see `package.json`/`.nvmrc` if present), `npm`, and —
only if you want the on-chain end-to-end steps in section 6 — Docker and the
[Stellar CLI](https://developers.stellar.org/docs/tools/cli/stellar-cli)
(`cargo install --locked stellar-cli`).

## 2. Start the backend + Postgres (3 min)

The frontend calls the Nest backend on `http://localhost:3001`. There is
**no Docker Compose file in this repo yet** (some docs reference a
`docker-compose.dev.yml` that does not exist), so start dependencies
manually:

```bash
# 1. Start PostgreSQL (just the DB via Docker, if you have Docker)
docker run -d -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=myfans \
  -e POSTGRES_USER=myfans \
  postgres:15

# 2. Configure the backend
cd backend
cp .env.example .env
# Edit .env — set DB_PASSWORD (matching the docker run above: postgres),
# JWT_SECRET, and WEBHOOK_SECRET to random values.

# 3. Run migrations, then start the API
npm run migration:run
npm run start:dev
```

Leave the backend running (on `:3001`). If you don't have Docker or want to
skip Postgres, you can still load the frontend UI — API-backed pages will show
error states, but the wallet/contract-config pages render fine.

(Equivalently, run the backend from the repo root with `npm run dev:backend`.)

## 3. Configure the frontend environment (2 min)

```bash
cd frontend
cp .env.example .env.local
```

Defaults in `.env.example` point at the local backend (`http://localhost:3001`)
and Stellar **testnet**. The contract-ID vars are empty by design — see
[section 6](#6-go-end-to-end-create-a-plan--subscribe-local-sandbox) for how
to fill them. **Without IDs the app still loads**; it only shows
contract-config validation warnings.

## 4. Install and run (3 min)

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. The app talks to the backend through Next's
same-origin `/api/v1/*` proxy (configured in `next.config.ts`), so you should
**not** need to touch CORS for normal API calls.

## 5. Connect Freighter (5 min)

1. Install the [Freighter](https://freighter.app) browser extension and create
   / import / unlock a wallet.
2. Switch Freighter's network to match `NEXT_PUBLIC_STELLAR_NETWORK` in
   `.env.local` (default: **Test Net**). Freighter → Settings → Preferences →
   Network. If you set up a local sandbox in section 6, configure a custom
   **Standalone** network instead (see that section).
3. In the app, open the wallet connect flow (e.g. `/wallet-demo`, or the
   "Connect wallet" button in the nav) and choose **Freighter**.
4. Approve the connection request in the Freighter popup — you should land
   back with a connected address shown. If nothing happens, see
   [Troubleshooting](#troubleshooting) before retrying.

## 6. Go end-to-end: create a plan & subscribe (local sandbox)

The subscribe flow calls **five Soroban contracts** (token, creator registry,
subscription, content access, earnings). To exercise that on-chain you need a
set of deployed contract IDs. The fastest offline way is a **local Stellar
sandbox** — no public testnet funding or API keys required.

> If you just want to browse the UI, skip this section — the app runs fine
> with empty IDs (validation warnings only).

### 6a. Run a local Stellar sandbox

```bash
docker run --rm -it -p 8000:8000 --name stellar \
  stellar/quickstart:testing --local --enable-soroban-rpc
```

This starts Horizon and Soroban RPC locally. Record the **root admin secret
key** printed in the logs — it keys the sandbox. `--local` also serves
friendbot at `http://localhost:8000/friendbot`, so CLI identity funding works.

### 6b. Point the Stellar CLI at it

```bash
stellar network add local \
  --rpc-url http://localhost:8000/soroban/rpc \
  --network-passphrase "Standalone Network ; February 2017"

stellar keys generate alice --network local   # auto-funded via friendbot
```

### 6c. Build the contracts to WASM

```bash
cd contract
npm run build   # cargo build --release --target wasm32-unknown-unknown
```

Artifacts land in `contract/target/wasm32-unknown-unknown/release/*.wasm`.

### 6d. Deploy the five contracts

Deploy each contract whose crate lives in `contract/contracts/` and capture
the returned contract ID:

```bash
stellar contract deploy \
  --wasm contract/target/wasm32-unknown-unknown/release/<crate>.wasm \
  --source alice --network local
# repeat for: myfans-token, creator-registry, subscription, content-access, earnings
```

`<crate>.wasm` is the crate's lib target name under
`contract/contracts/<crate>/src` (e.g. `myfans_token.wasm`). Pick the artifact
whose name matches the crate being deployed.

> The five contracts must also be **initialized** (e.g. `init`/`initialize`)
> before they answer the methods the UI calls. Run
> `stellar contract invoke` with the init args from that contract's source in
> `contract/contracts/<crate>/src/lib.rs` — exact names/signatures live there
> plus the interface docs under `contract/docs/interfaces/`. Note: the
> contract source and `contract/docs/` are **not present in a partial
> checkout** — clone the full workspace if you need to inspect them.

### 6e. Wire the IDs into the frontend

In `frontend/.env.local`:

```env
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_SOROBAN_RPC_URL=http://localhost:8000/soroban/rpc
NEXT_PUBLIC_HORIZON_URL=http://localhost:8000
NEXT_PUBLIC_MYFANS_TOKEN_CONTRACT_ID=<contract-id>
NEXT_PUBLIC_CREATOR_REGISTRY_CONTRACT_ID=<contract-id>
NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ID=<contract-id>
NEXT_PUBLIC_CONTENT_ACCESS_CONTRACT_ID=<contract-id>
NEXT_PUBLIC_EARNINGS_CONTRACT_ID=<contract-id>
```

`NEXT_PUBLIC_STELLAR_NETWORK` stays `testnet` (for network labels); the RPC /
Horizon overrides point the app at the sandbox. Restart `npm run dev` after
editing `.env.local`. `localhost:*` and these two configured hosts are already
CSP-allowlisted in dev (see [docs/CSP.md](./CSP.md)), so no header changes are
needed.

### 6f. Point Freighter at the sandbox

Freighter signs against **its own** network context. Add a custom network in
Freighter to match the sandbox:

- Name: `Standalone` (or anything)
- Horizon URL: `http://localhost:8000`
- RPC URL: `http://localhost:8000/soroban/rpc`
- Network passphrase: `Standalone Network ; February 2017`
- Enable "Allow connecting to non-HTTPS networks"

Fund the connected account from the sandbox friendbot
(`http://localhost:8000/friendbot`). Then create a plan and subscribe from the
creator page / `/subscribe` flow as you would on testnet.

## 7. Smoke test (3 min)

- [ ] At least one API-backed page (e.g. `/discover`) renders instead of an
      error state — confirms the backend proxy is reachable.
- [ ] Freighter connects and shows an address (section 5).
- [ ] No `Content-Security-Policy` violations in the console when connecting
      the wallet (see `docs/CSP.md` if you do).
- [ ] (End-to-end) A contract-config warning is gone — IDs validated.

## Windows setup

There is **no `setup.bat` script in the repo** today, so on Windows:

- Install `rustup` for Windows if you need to build/deploy contracts, and add
  the WASM target: `rustup target add wasm32-unknown-unknown`.
- Prefer **WSL / WSL2** to run the Docker sandbox (section 6) and the
  `stellar` CLI; it keeps the commands identical to Linux/macOS.
- The `npm run install:all`, `npm run dev`, and backend `npm run start:dev`
  commands all run in Windows `cmd` / PowerShell as-is.

## Troubleshooting

### Freighter isn't detected / "install wallet" prompt shown

- Make sure the extension is enabled for the current browser profile and the
  tab was loaded (or reloaded) **after** installing it.
- Freighter injects its API into `window` on page load — a hot-reloaded page
  sometimes misses it; do a hard refresh.

### Network mismatch (testnet / sandbox)

- The wallet's selected network must match the network your contract IDs and
  RPC point at. Mismatches usually show up as a signing error or an
  invalid-transaction response from Horizon/Soroban RPC rather than an obvious
  "wrong network" message.
- For the **testnet** defaults, Freighter must be on **Test Net**.
- For a **local sandbox**, Freighter must be on the custom **Standalone**
  network from [section 6f](#6f-point-freighter-at-the-sandbox) — a sandbox
  RPC with Freighter still on Test Net will fail to find the contract.

### Wallet calls fail with a CSP / "Refused to connect" console error

- This means the RPC/Horizon host is not in the CSP `connect-src` allowlist.
  If you've set a custom `NEXT_PUBLIC_SOROBAN_RPC_URL` or
  `NEXT_PUBLIC_HORIZON_URL`, restart `npm run dev` after editing `.env.local` —
  Next only reads env at server start. In dev, `localhost:*` plus the two
  configured hosts are allowed automatically. See `docs/CSP.md` for exactly
  which hosts are allowed and how to add one.

### API calls fail with a CORS error in the console

- Requests through the app's own fetch calls should go via `/api/v1/*`, which
  Next rewrites server-side (no CORS involved). A CORS error usually means
  either the backend isn't running on the port `NEXT_PUBLIC_API_URL` points at
  (default `http://localhost:3001`), or some code calls the backend origin
  directly, bypassing the `/api/v1` proxy.

### `.env.local` changes don't seem to take effect

- Restart `npm run dev`. Next.js only reads `NEXT_PUBLIC_*` env vars at
  build/server start, not on hot reload.

## Related docs

- [`docs/CSP.md`](./CSP.md) — CSP `connect-src` host allowlist and how
  wallet/RPC hosts get added to it.
- [`docs/WALLET_SETUP.md`](./WALLET_SETUP.md) — wallet support matrix, feature
  flag, and how signing is dispatched (Freighter / Lobstr / WalletConnect).
- [`src/components/wallet/README.md`](../src/components/wallet/README.md) —
  wallet connection system internals (multi-wallet support, reconnection,
  error handling).
- Root [`README.md`](../../README.md) — full-stack setup (contract + backend +
  frontend together).