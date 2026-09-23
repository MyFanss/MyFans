# Idempotency

This document describes how the backend guarantees that retried or duplicated
requests do not produce duplicate side effects. It applies to every mutating
endpoint that moves money or state, including creator earnings withdrawals.

## General pattern: prepare / confirm

Mutating flows that touch an external system (chain, payment provider, indexer)
use a two-phase **prepare / confirm** pattern:

1. **Prepare** — the client sends the intent plus a client-generated
   `idempotencyKey`. The backend validates the request, reserves the operation
   under that key, and returns a `prepareId` (or the previously stored result if
   the key was already seen). No irreversible side effect happens yet.
2. **Confirm** — the client sends the `prepareId` (and the signed payload where
   applicable). The backend executes the operation exactly once and records the
   terminal result against the key.

Replaying either phase with the same `idempotencyKey` returns the stored result
instead of re-executing. Replaying with a *different* key is treated as a new
request and is subject to normal validation (balance, auth, pause state).

## Key requirements

- Keys are scoped per caller (creator/user id) and per operation type, so one
  caller cannot collide with another.
- A key is bound to the request fingerprint (amount, destination, operation).
  Reusing a key with a different payload is rejected rather than silently
  accepted.
- Records are persisted before the external call and updated after it, so a
  crash between phases leaves a recoverable `pending` record, never a silent
  double-spend.
- Terminal states (`confirmed`, `failed`) are immutable; only `pending` records
  may transition.

## EarningsModule withdraw

The creator earnings withdraw flow follows this pattern:

- `prepareWithdraw(creatorId, amount, idempotencyKey)` validates the creator's
  available balance and pause state, reserves the amount, and returns a
  `prepareId`. It does **not** move funds.
- `confirmWithdraw(creatorId, prepareId, idempotencyKey)` verifies the reserved
  operation, requires the creator's authorization (the on-chain withdraw is
  gated by `require_auth(creator)`), and settles exactly once.

### Fee accounting

Subscription payments are already split at payment time: the protocol fee is
removed before the remainder is credited to the creator's earnings balance.
The withdraw path therefore **must not** re-apply the protocol fee. Withdrawing
`amount` debits exactly `amount` from the creator's balance and pays out exactly
`amount`. Applying a fee again here would double-charge the creator.

### Failure modes

- **Withdraw more than balance** — rejected during prepare; no reservation is
  created.
- **Concurrent withdraws** — the balance reservation is atomic, so two
  in-flight prepares cannot both reserve the same funds; the second fails
  validation.
- **Wrong signer** — confirm rejects when the authorization does not match the
  creator that owns the reservation.
- **Paused earnings** — prepare rejects while earnings are paused; existing
  pending reservations are not settled until unpaused.

## Admin operations

Administrative drains or overrides are not part of the normal withdraw path and
must be gated by the `AUTH_MATRIX` role checks. There is no silent admin drain:
any privileged movement of creator funds requires an explicit, audited role and
is recorded with the same idempotency guarantees.
