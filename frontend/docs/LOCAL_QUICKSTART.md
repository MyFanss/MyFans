# Local quickstart

The first-hour guide for running the MyFans frontend locally.

## Environment variables

The app is a Next.js app. It only reads variables prefixed with
`NEXT_PUBLIC_`, and it reads them when the dev server (or build) starts —
set them in `frontend/.env.local` and restart `npm run dev` after changing
them.

> **Do not copy `VITE_` names from older samples.** Some legacy
> WalletConnect-era code still mentions `VITE_` variables, but this app
> never reads them. Setting only `VITE_` variables changes nothing, and the
> app silently stays on its defaults — testnet included.

### Required reading for a first run

| Variable | Example | Default if missing | What breaks if it is missing |
|---|---|---|---|
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` | `testnet` | Nothing crashes, which is the trap: the app stays on testnet. Set `public` (or `mainnet`) for the public network; `futurenet` is also accepted. Unrecognised values fall back to `testnet`. |
| `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` (testnet) or `Public Global Stellar Network ; September 2015` (public) | None — there is no default | Signing is refused. The app deliberately fails closed instead of signing with a guessed passphrase, so wallet actions that need a signature cannot proceed until this matches `NEXT_PUBLIC_STELLAR_NETWORK`. |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | `http://localhost:3001` | The app talks to a backend at `http://localhost:3001` whether or not one is running there. Point it at your backend anywhere else (staging, a tunnel, a teammate's machine) or every API call fails. |

These are read in `frontend/src/config/network.ts` (network and
passphrase) and `frontend/src/lib/api/base-url.ts` (API URL, used by the
plan and API helpers such as `frontend/src/lib/plans.ts`).

### Also read at build/config time

`frontend/next.config.ts` reads a few more `NEXT_PUBLIC_` variables. None
of them are needed for a normal local run:

| Variable | Default if missing | Effect |
|---|---|---|
| `NEXT_PUBLIC_FLAG_DEMOS` | Demos on in non-production builds, off in production | Set to `true` to compile the `page.demo.tsx` story routes into a production build. |
| `NEXT_PUBLIC_ENABLE_WALLETCONNECT` | Off | WalletConnect relay hosts are only added to the CSP allowlist when this is exactly `true`. |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Unset | Used to derive CSP `connect-src` hosts for Soroban RPC calls. |
| `NEXT_PUBLIC_HORIZON_URL` | Unset | Used to derive CSP `connect-src` hosts for Horizon calls. |
| `NEXT_PUBLIC_CSP_EXTRA_CONNECT_SRC` | Empty | Extra comma-separated `connect-src` origins for staging/local APIs. Ignored in production. |
