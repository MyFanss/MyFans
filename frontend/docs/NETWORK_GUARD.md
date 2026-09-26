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

## Fail-closed behavior

The guard fails closed: if the wallet is present but its network cannot be read
(RPC unreachable, wallet locked, or an unrecognized network id), the guard
treats the state as a mismatch and blocks the mutation rather than allowing it
through. Only the explicit "no wallet connected" case no-ops, so read-only
status checks keep working for logged-out visitors.

## What is NOT gated

- **Read-only simulation** (`checkSubscription`, RPC reads). `assertWalletNetworkMatches()`
  no-ops when there is no wallet, so status checks keep working for logged-out
  visitors.
- Auto-switching the wallet's network — out of scope.

## Error code

`NETWORK_MISMATCH` is a stable `ErrorCode` (see `src/types/errors.ts`). Its
user-facing copy lives in `getErrorDefaults`. Don't rename it — UI and tests
match on it.

## UI

`<NetworkMismatchBanner />` (uses `useNetworkGuard`) renders a persistent,
blocking alert whenever a mismatch is active. It stays mounted for as long as
the mismatch persists (including live wallet network switches) and is mounted
on:

- `src/components/subscribe/ConfirmationScreen.tsx` (subscribe)
- `src/app/subscriptions/page.tsx` (cancel / renew)
- `src/app/dashboard/plans/page.tsx` (create plan)

The settings view surfaces the expected vs actual network so users can see
exactly which network the app expects and which one their wallet is on.

## Tests

`frontend/e2e/network-status.spec.ts` covers the mismatch banner and the
hard-block on mutating calls.
