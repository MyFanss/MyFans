# Wallet setup

MyFans connects fans and creators to Stellar/Soroban through browser and mobile
wallets. This document covers configuration; the connection UI lives in
`src/components/wallet/` and the low-level client in `src/lib/wallet.ts`.

## Supported wallets

| Wallet | Connect | Sign | Notes |
|--------|---------|------|-------|
| Freighter | ✅ browser extension | ✅ | Reference wallet — the only one guaranteed through every flow. The local onboarding guide ([LOCAL_QUICKSTART.md](./LOCAL_QUICKSTART.md)) is Freighter-only |
| Lobstr | ✅ browser extension | ✅ | Same `signTransaction` dispatch path as Freighter, but less battle-tested |
| WalletConnect | ✅ QR / deep link | ✅ | Behind the `walletConnect` feature flag, off by default |

> **Local development:** use **Freighter**. Connect + sign work for Lobstr, but
> Freighter is the validated path for subscribing and for connecting to a
> local Stellar sandbox (see [local quickstart](LOCAL_QUICKSTART.md)).

### How signing is dispatched

`signTransaction(xdr, options?)` in `src/lib/wallet.ts` picks a signer in this
order:

1. `options.walletType` if passed explicitly.
2. The wallet recorded in the session store (`src/lib/client-session.ts`) at
   connect time — `useWallet`, `WalletSelectionModal`, and the subscribe
   `WalletGate` all persist this.
3. Freighter, as a legacy fallback.

Unknown wallet types throw a structured `UNSUPPORTED_WALLET` `AppError`.

## WalletConnect

WalletConnect uses [`@walletconnect/sign-client`](https://www.npmjs.com/package/@walletconnect/sign-client)
and is **disabled by default**. The provider module (`src/lib/walletconnect.ts`)
is loaded lazily, so the SDK is only pulled into the bundle when a fan actually
connects with WalletConnect.

### Enable it

```bash
# .env.local
NEXT_PUBLIC_FEATURE_WALLET_CONNECT=true
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<your WalletConnect Cloud project id>
```

- Get a project ID from <https://cloud.walletconnect.com>.
- The project ID is **required** when the flag is on. Without it, connecting
  throws `WALLET_CONNECT_CONFIG_MISSING` and the modal explains what to set.
- With the flag **off**, the wallet list shows WalletConnect as "Coming soon"
  and Freighter/Lobstr are unaffected.

### Pairing UI

While a WalletConnect session is pending, `src/lib/walletconnect.ts` dispatches a
`wallet:walletconnect:uri` event on `window` with `{ detail: { uri } }` (and
`{ uri: null }` once it resolves/fails). `WalletSelectionModal` listens for this
and renders a deep link. To show a scannable QR code, render the `uri` with a QR
component in that listener — no other wiring is required.

### Chain mapping

| App network | WalletConnect chain |
|-------------|---------------------|
| `mainnet` / `public` | `stellar:pubnet` |
| anything else | `stellar:testnet` |

Methods requested: `stellar_signXDR`, `stellar_signAndSubmitXDR`.

## Network labels

The connected-wallet chip and settings badge derive their label from runtime
config / the backend `/config/network` endpoint via `useBackendNetwork()` and
`stellarNetworkLabel()` (`src/lib/network-label.ts`). The string "Public" only
appears on a genuine public-network build; testnet builds always read
"Stellar Testnet".

## Testing

- `src/lib/__tests__/wallet.test.ts` — connect + signing dispatch per wallet type.
- `src/lib/__tests__/walletconnect.test.ts` — mocked Sign Client: connect, sign,
  disconnect, missing project ID.
- `src/lib/__tests__/network-label.test.ts` / `src/hooks/__tests__/useBackendNetwork.test.ts`
  — network label never says "Mainnet" off the public network.
