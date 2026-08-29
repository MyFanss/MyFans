# Event indexing

This document defines the canonical subscription event contract used by the Soroban poller and the backend indexer.

## Canonical event names

The poller only indexes these canonical names:

- `subscribed`
- `extended`
- `cancelled`

These names are stored in the shared fixture at `backend/src/subscriptions/fixtures/subscription-event-fixture.json` and are exported via `TARGET_EVENTS` in `backend/src/subscriptions/subscription-event-fixture.ts`.

## Compatibility aliases

Historical or renamed topic strings are normalized before indexing. The poller accepts the following aliases and canonicalizes them:

| Legacy/renamed topic | Canonical topic |
|---|---|
| `subscription_created` | `subscribed` |
| `subscription_extended` | `extended` |
| `subscription_cancelled` | `cancelled` |

Any other topic is ignored as unknown and is not indexed.

## Poller behavior

1. Verify the event was emitted by the configured subscription contract.
2. Read the topic name at index 1.
3. Normalize the topic using the alias map from the shared fixture.
4. Accept only canonical target events.
5. Ignore unknown values, log them at debug level, and continue.
6. Upsert ledger/event idempotently so duplicate polling is harmless.

## Processing contract

The backend parser expects the subscription event schema below:

- `subscribed`: topics `(name, fan, creator)`, data `plan_id`
- `extended`: topics `(name, fan, creator)`, data `plan_id`
- `cancelled`: topics `(name, fan, creator)`, data `(true, reason)`

If the event payload is structurally different, the parser should skip it rather than silently creating bad state.

## Versioning and CI policy

- The fixture is the source of truth for the canonical target event set.
- Any change to event names requires updating the fixture first.
- CI fails if the poller target list and the shared fixture diverge.
- The parser must ignore unrecognized event names and never treat them as valid subscriptions.
- Backward-compatible aliases are accepted for a transition window, but the canonical name remains stable.
