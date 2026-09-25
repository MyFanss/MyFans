# Wallet Setup

This guide covers the reference wallet path used by the frontend: **Freighter**
(the only guaranteed wallet for monetization demos), with **Lobstr** supported
where available.

## Supported wallets

| Wallet   | Connect | Network detect | signTransaction | Notes |
| -------- | ------- | -------------- | --------------- | ----- |
| Freighter | Yes     | Yes            | Yes             | Reference path; required for demos |
| Lobstr    | Yes     | Yes            | Yes             | Optional; dispatched separately from Freighter |

Hardware wallets (e.g. Ledger) are **out of scope** for this path.

## Prerequisites

1. Install the Freighter browser extension.
2. Create or import an account in Freighter.
3. Switch Freighter to the **same network** the app is configured for
   (testnet for local development).

> Never enter a secret key into the app. The app only ever asks the wallet to
> sign a transaction; it never requests or stores secret keys.

## Connect

The wallet module detects which supported wallet is available and connects via
`requestAccess`. Dispatch is by wallet type: Freighter and Lobstr each have
their own connect path, so a half-wired wallet cannot silently fall through to
the other. If no supported extension is present, the user sees a clear message
pointing them at the install page instead of a silent failure.

When **both** extensions are installed, the wallet the user selected in the
connect modal is the one used for the session; the other is ignored. Switching
wallets mid-session re-runs connect and re-checks the network guard before any
signing is allowed.

## Network guard

Before any transaction is built, the wallet's active network is compared
against the app's configured network passphrase. On a mismatch the flow is
**blocked** and the user is told which network to switch to. This prevents
signing a testnet transaction with a mainnet account (or vice versa).

See `frontend/docs/NETWORK_GUARD.md` for the guard details.

## Signing subscribe / cancel

Subscribe and cancel transactions are built by the app and routed through the
active wallet's `signTransaction` — Freighter and Lobstr each have a dedicated
sign path selected by wallet type. The signed envelope is then submitted by the
app. The app never signs on the user's behalf.

## Error mapping

Wallet errors are translated into user-readable messages. Dispatch failures
(unknown wallet type, missing sign path) surface through the same error UX as
the conditions below, so a misrouted wallet is never a silent no-op:

| Condition            | Message shown to the user |
| -------------------- | ------------------------- |
| Freighter missing    | Install the Freighter extension to continue. |
| Lobstr missing       | Install the Lobstr extension to continue. |
| Wrong network        | Switch <wallet> to <network> and try again. |
| User rejected sign   | You cancelled the signature request. |
| Popup blocked        | Allow popups for this site, then retry. |
| Unsupported wallet   | This wallet is not supported for signing yet. |

## Testing

- Unit tests cover wallet dispatch (connect / network detect / sign) for both
  Freighter and Lobstr routes.
- `frontend/e2e/network-status.spec.ts` covers the network guard.
- The subscribe flow is exercised with a mocked wallet.

## Honesty note

This document reflects the current reference path. Freighter is the only
wallet guaranteed to work end-to-end; Lobstr is best-effort and dispatched
separately. Full Lobstr **mobile** support is out of scope and not guaranteed.
