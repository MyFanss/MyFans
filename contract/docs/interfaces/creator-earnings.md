# Interface: creator-earnings

> **Crate role (see also `earnings.md`):** `creator-earnings` is the **per-creator
> earnings ledger**. It owns the balance a single creator has accrued from
> subscription revenue splits and the withdraw path that moves that balance out.
> It does **not** compute or apply the protocol fee — the fee is already split at
> subscription time (see `earnings.md`). Its sibling crate `earnings` owns the
> protocol-level fee split and aggregate accounting. Keep the two strictly
> demarked: `creator-earnings` = per-creator balance + withdraw auth;
> `earnings` = protocol fee split + aggregate totals.

## Purpose

Track and pay out the earnings accrued to an individual creator.

## Storage

- `Balance(creator: Address) -> i128` — accrued, withdrawable balance for a creator.
- `Paused: bool` — when true, withdrawals are disabled (admin-controlled).

## Messages

### `withdraw(creator: Address, amount: i128)`

Moves `amount` from the creator's accrued balance to the creator.

**Authorization:** requires `creator.require_auth()`. Any call where the
signer is not `creator` MUST revert unchanged (no state mutation, no transfer).

**Accounting:** the protocol fee is split at subscription time and is **not**
re-applied here. `withdraw` transfers exactly `amount`; it must never deduct an
additional protocol fee (no double-fee).

**Failure modes (all revert unchanged):**

- `amount <= 0`.
- `amount > Balance(creator)` — cannot withdraw more than the balance.
- `Paused == true` — earnings paused.
- Wrong signer — `require_auth(creator)` fails.

**Concurrency:** balance is debited before the transfer so concurrent withdraws
cannot over-spend; the second call sees the reduced balance and reverts if it
exceeds it.

### `balance(creator: Address) -> i128`

Read-only. Returns the creator's accrued balance. MUST match the sum of indexed
payment splits for that creator.

## Admin

- `set_paused(paused: bool)` — requires the admin role per `AUTH_MATRIX`.
  There is no admin path to silently drain a creator's balance; admin can only
  pause/unpause withdrawals.

## Related

- `earnings.md` — protocol fee split and aggregate accounting.
- `AUTH_MATRIX` — role required for admin actions.
