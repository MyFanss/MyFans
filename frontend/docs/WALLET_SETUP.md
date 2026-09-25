# Wallet Setup

This guide covers the reference wallet path used by the frontend: **Freighter**
(the only guaranteed wallet for monetization demos), with **Lobstr** supported
where available.

## Supported wallets

| Wallet   | Connect | Network detect | signTransaction | Notes |
| -------- | ------- | -------------- | --------------- | ----- |
| Freighter | Yes     | Yes            | Yes             | Reference path; required for demos |
| Lobstr    | Yes     | Yes            | Yes             | Optional |

Hardware wallets (e.g. Ledger) are **out of scope** for this path.

## Prerequisites

1. Install the Freighter browser extension.
2. Create or import an account in Freighter.
3. Switch Freighter to the **same network** the app is configured for
   (testnet for local development).

> Never enter a secret key into the app. The app only ever asks Freighter to
> sign a transaction; it never requests or stores secret keys.

## Connect

The wallet module detects Freighter availability and connects via
`requestAccess`. If the extension is missing, the user sees a clear message
pointing them at the install page instead of a silent failure.

## Network guard

Before any transaction is built, the wallet's active network is compared
against the app's configured network passphrase. On a mismatch the flow is
**blocked** and the user is told which network to switch to. This prevents
signing a testnet transaction with a mainnet account (or vice versa).

See `frontend/docs/NETWORK_GUARD.md` for the guard details.

## Signing subscribe / cancel

Subscribe and cancel transactions are built by the app and routed through
Freighter's `signTransaction`. The signed envelope is then submitted by the
app. The app never signs on the user's behalf.

## Error mapping

Wallet errors are translated into user-readable messages:

| Condition            | Message shown to the user |
| -------------------- | ------------------------- |
| Freighter missing    | Install the Freighter extension to continue. |
| Wrong network        | Switch Freighter to <network> and try again. |
| User rejected sign   | You cancelled the signature request. |
| Popup blocked        | Allow popups for this site, then retry. |

## Testing

- Unit tests cover wallet dispatch (connect / network detect / sign).
- `frontend/e2e/network-status.spec.ts` covers the network guard.
- The subscribe flow is exercised with a mocked wallet.

## Honesty note

This document reflects the current reference path. Freighter is the only
wallet guaranteed to work end-to-end; other wallets are best-effort.
