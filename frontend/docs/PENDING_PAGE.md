# Pending Page

The pending page is shown after a user submits a checkout transaction and before the
subscription is confirmed on-chain. It must never grant access on its own; it only
reflects the state machine owned by the backend.

## Checkout state machine

A checkout/subscription record moves through explicit states:

```
CREATED -> SUBMITTED -> CONFIRMED
                     \-> FAILED
```

- `CREATED`: checkout intent recorded, no transaction hash yet.
- `SUBMITTED`: the client supplied a transaction hash; it has **not** been verified.
- `CONFIRMED`: an on-chain `subscribe` event was observed (or a trusted simulation
  plus payment proof was verified) and the transaction was validated against the
  expected invoke arguments.
- `FAILED`: verification failed, the transaction reverted, or the record timed out
  while stuck in `SUBMITTED`.

`ACTIVE` is only ever set as a consequence of `CONFIRMED`. Marking a subscription
`ACTIVE` while the record is still `CREATED` or `SUBMITTED` is an integrity bug and
must be rejected by the backend.

## Invariants

1. **No early ACTIVE.** A subscription cannot become `ACTIVE` until the record is
   `CONFIRMED`. Attempting to activate from `CREATED` or `SUBMITTED` fails.
2. **Verify, never trust.** A client-supplied transaction hash is untrusted input.
   The backend verifies it via RPC against the expected invoke arguments (contract
   id, function, subscriber, plan, amount) before any state change.
3. **Idempotent confirm.** Confirming the same transaction more than once is a no-op;
   the record stays `CONFIRMED` and no duplicate activation occurs.
4. **Timeouts fail closed.** Records left in `SUBMITTED` past the confirmation window
   transition to `FAILED` rather than remaining pending indefinitely.

## Pending API

The pending page reads real data from the pending API. The API returns the current
state of the checkout record and, when available, the observed on-chain event:

```json
{
  "checkoutId": "...",
  "state": "SUBMITTED",
  "txHash": "0x...",
  "confirmedAt": null,
  "failureReason": null
}
```

- `state` is one of `CREATED`, `SUBMITTED`, `CONFIRMED`, `FAILED`.
- `confirmedAt` is populated only once the on-chain `subscribe` event is observed.
- `failureReason` is populated when the record transitions to `FAILED`.

The page polls this endpoint and renders the state. It does not infer success from
the presence of a transaction hash.

## Edge cases

- **User refreshes the confirm page.** The confirm endpoint is idempotent; a repeated
  confirm for an already `CONFIRMED` transaction returns the existing record.
- **Event delayed.** The record stays `SUBMITTED` until the event is observed or the
  timeout elapses; the UI shows a pending state, not access.
- **User lies about the tx hash.** RPC verification against the expected invoke
  arguments rejects hashes that do not match, moving the record to `FAILED`.

## Out of scope

Optimistic access (granting access before confirmation) is explicitly out of scope.
