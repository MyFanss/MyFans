# Network mismatch guard

A testnet deployment must never broadcast a transaction that a mainnet wallet
signed (or vice-versa). The subscribe flow already checked for this, but
`cancel`, `extend_subscription`, and `create_plan` did not — so the guard now
lives in the low-level Stellar layer where every mutating path goes through it.

## What is gated

`src/lib/network-guard.ts` exports `assertWalletNetworkMatches()`. It reads the
connected wallet's network (`window.freighter.getNetwork()` /
`window.lobstr.getNetwork()`), compares it to
`getRuntimeContractConfig().network`, and **throws** an `AppError` with code
`NETWORK_MISMATCH` when they differ.

It is called at the start of every sign/submit entry point in
`src/lib/stellar.ts`:

| Function                       | Path        |
| ------------------------------ | ----------- |
| `submitTransaction`            | submit      |
| `submitCreatePlanTx`           | submit      |
| `createCreatorPlanOnSoroban`   | sign + submit |
| `cancelSubscriptionOnSoroban`  | sign + submit |
| `extendSubscriptionOnSoroban`  | sign + submit |

`useSubscribeFlow` keeps its own up-front `mismatch` check for a faster UI
response; the stellar-layer guard is the backstop.

## What is NOT gated

- **Read-only simulation** (`checkSubscription`, RPC reads). `assertWalletNetworkMatches()`
  no-ops when there is no wallet or the wallet network can't be read, so status
  checks keep working for logged-out visitors.
- Auto-switching the wallet's network — out of scope.

## Error code

`NETWORK_MISMATCH` is a stable `ErrorCode` (see `src/types/errors.ts`). Its
user-facing copy lives in `getErrorDefaults`. Don't rename it — UI and tests
match on it.

## UI

`<NetworkMismatchBanner />` (uses `useNetworkGuard`) renders a blocking alert
whenever a mismatch is active. It is mounted on:

- `src/components/subscribe/ConfirmationScreen.tsx` (subscribe)
- `src/app/subscriptions/page.tsx` (cancel / renew)
- `src/app/dashboard/plans/page.tsx` (create plan)
