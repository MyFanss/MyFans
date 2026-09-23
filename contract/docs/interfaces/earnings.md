# Earnings Interface

## Purpose

The `earnings` crate is the **protocol-level earnings ledger**. It tracks
per-creator balances that accrue from subscription payments and exposes the
withdraw entry point used by the backend `EarningsModule`.

## Crate roles (demarcation)

Two similarly named crates exist. Their responsibilities are strictly
demarcated to avoid inconsistent withdraw rules and double-fee bugs:

| Crate | Role | Owns |
| --- | --- | --- |
| `earnings` | Protocol earnings ledger | Accrued balances, protocol fee split at subscription time, withdraw auth + transfer |
| `creator-earnings` | Creator-facing read/aggregation layer | Read-only views, per-creator aggregation, dashboard queries |

Rules:

- `earnings` is the **only** crate that mutates balances or moves funds.
- `creator-earnings` must never apply fees or authorize withdrawals; it only
  reads from `earnings`.
- Any new balance-mutating logic belongs in `earnings`, not `creator-earnings`.

## Fee split accounting

The protocol fee is applied **once**, at subscription time, when the payment is
split between the protocol treasury and the creator's earnings balance.

- Subscription payment -> split -> creator balance credited net of protocol fee.
- Withdraw -> transfers the already-netted balance. **Withdraw MUST NOT
  re-apply the protocol fee.**

Re-applying the fee on withdraw is a double-fee bug and is explicitly
forbidden.

## Withdraw

```
withdraw(creator, amount)
```

Requirements:

1. `require_auth(creator)` — the withdraw must be authorized by the creator
   whose balance is being debited. Unauthorized withdraws revert unchanged.
2. `amount <= balance(creator)` — withdrawing more than the balance reverts.
3. Earnings must not be paused; a paused earnings contract rejects withdraws.
4. Concurrent withdraws are serialized by the ledger; the second withdraw sees
   the post-debit balance and reverts if it exceeds it.
5. No admin path may silently drain a creator balance without the
   `AUTH_MATRIX` role required for treasury operations.

## Backend orchestration (`EarningsModule`)

The backend uses a prepare/confirm withdraw pattern:

1. **prepare** — validate the request, compute the withdraw id, and persist an
   idempotency record keyed by `withdrawId`.
2. **confirm** — submit the on-chain withdraw and mark the idempotency record
   confirmed.

Idempotency guarantees:

- Replaying `prepare` with the same `withdrawId` returns the existing record
  instead of creating a new one.
- Replaying `confirm` for an already-confirmed `withdrawId` is a no-op and does
  not submit a second on-chain transfer.

## Failure modes

- Withdraw more than balance -> revert.
- Concurrent withdraws -> second reverts on insufficient balance.
- Wrong signer -> `require_auth` fails, revert unchanged.
- Paused earnings -> withdraw rejected.

## Security considerations

- No admin silent drain without the `AUTH_MATRIX` role.
- Payout amount logging is optional and may be redacted.

## Out of scope

- Fiat off-ramp.
