# Wallet Setup

This guide covers connecting a Stellar wallet (e.g. Freighter) to the
subscription frontend and the preflight checks the UI performs before a fan
submits a `subscribe` / `renew` transaction.

> **Security note:** the checks below are **complementary UX only**. They are
> *not* a security boundary. The subscription contract enforces asset
> correctness, trustlines, allowances, and atomicity on-chain. A malicious or
> outdated client cannot bypass those guarantees by skipping preflight.

## Supported assets

Plans are priced in exactly one asset, identified by an `AssetId`:

- **Native XLM** — the native sentinel (no contract address).
- **SAC token** — a Stellar Asset Contract address (e.g. USDC).

The plan metadata returned by the backend includes the asset contract id (or
native sentinel) and the amount. The frontend must transfer the **same asset**
the plan was created with; renewing with a different asset reverts on-chain.

## Preflight checks (UX only)

Before submitting, the frontend should verify the fan can actually pay:

### 1. Balance

- **XLM:** ensure the account has enough spendable XLM (leave room for the
  base reserve and fees).
- **SAC:** ensure the account holds enough of the token.

If insufficient, surface `insufficient_balance` and block submission.

### 2. Trustline (SAC only)

SAC tokens require the fan to hold a trustline for the asset. If the trustline
is missing, the transfer will fail on-chain with `trustline_missing`. Prompt
the fan to add the trustline in their wallet before retrying.

### 3. Allowance (SAC only)

Some SAC token flows require the fan to approve an allowance for the spender
before the contract can pull funds. If the allowance is missing or too low, the
transaction fails with `allowance_missing`. Prompt the fan to approve the
required allowance in their wallet.

### 4. Supported asset

If the plan's asset is not in the configured allowlist (when the feature is
enabled) or the SAC client cannot be validated, the contract rejects the plan
with `unsupported_asset`. The frontend should treat this as a hard failure and
not attempt the transfer.

## Error codes

The contract surfaces distinct typed errors so the UI can react precisely:

| Code | Meaning | Suggested UX |
| --- | --- | --- |
| `insufficient_balance` | Fan lacks funds for the plan asset | Show balance, block submit |
| `trustline_missing` | Fan has no trustline for the SAC token | Prompt to add trustline |
| `allowance_missing` | Fan has not approved the required allowance | Prompt to approve allowance |
| `unsupported_asset` | Plan asset not allowed / SAC invalid | Hard fail, do not submit |

## Atomicity

`subscribe` and `renew` are atomic: if the creator cannot receive the asset, or
any step fails, the whole transaction reverts with no partial fee. The frontend
does not need to (and must not) attempt to compensate for partial failures.

## Renewals

A renewal must use the **same asset** as the original plan. If the plan's asset
changed or the fan attempts a different asset, the transaction reverts. Always
re-read plan metadata before renewing.

## Golden test vectors (builder regression guard)

The frontend builders for `subscribe`, `cancel`, and `extend` are pinned to
golden XDR vectors so a builder regression (empty or wrong invoke tx) fails CI
instead of shipping. See `contract/test-vectors/TEST_VECTORS.md` for the full
regen procedure and the vector schema.

- Vectors live in `contract/test-vectors/` as JSON, one file per operation
  (`subscribe.json`, `cancel.json`, `extend.json`).
- Each vector records the **network passphrase**, the contract id, the
  operation args, and the expected auth footprint.
- A vitest suite compares the frontend builder output against these vectors and
  fails on any mismatch (wrong contract id, network mismatch, or extend
  overflow args).
- Vectors contain **no private keys** — only public inputs and expected XDR.

Run the comparison locally with the frontend test suite; CI runs the same
suite so builder drift is caught before merge. To regenerate vectors after an
intentional contract change, follow the procedure in
`contract/test-vectors/TEST_VECTORS.md`.
