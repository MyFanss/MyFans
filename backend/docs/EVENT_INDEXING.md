# Event Indexing

This document describes how Soroban contract events are indexed by the backend
poller and how the shared event topic fixture keeps the contract CI and the
backend `TARGET_EVENTS` in sync.

## Shared event topic fixture

The single source of truth for Soroban event topics and bodies is:

```
contract/fixtures/subscription-events.json
```

Both sides consume this fixture:

- **Contract CI** — `contract/scripts/check-subscription-event-fixture.test.mjs`
  emits the topics/bodies declared in the fixture and fails the build if the
  contract no longer matches.
- **Backend poller** — `TARGET_EVENTS` is imported/generated from the fixture
  rather than hand-maintained, so poller topics cannot silently diverge from
  the events the contract actually emits.

If poller topics diverge from emitted events, subscriptions never confirm and
checkout stays `Pending` forever. CI enforces fixture sync to prevent this.

## Fixture versioning

The fixture carries a `version` field. When a topic is renamed or a new event
is added:

1. Update `contract/fixtures/subscription-events.json` (bump `version`).
2. Update the contract emit sites to match the fixture topics/bodies.
3. Regenerate/import `TARGET_EVENTS` from the fixture.
4. Run the fixture unit tests and the poller unit tests with fixture replay.

CI fails on any mismatch between the fixture, the contract emit sites, and the
backend `TARGET_EVENTS`.

## Failure modes

- **Topic rename** — caught by the fixture sync check in CI.
- **Extra event without handler** — the poller dead-letters events that have no
  registered handler instead of panicking.
- **Duplicate deliveries** — handlers must be idempotent; duplicate deliveries
  are ignored by the subscription state machine.

## Security considerations

Malformed events must not panic the poller. Unparseable or unknown events are
routed to the dead-letter path so a single bad event cannot halt indexing.

## References

- `backend/docs/EVENTS.md`
- `contract/fixtures/subscription-events.json`
- `contract/scripts/check-subscription-event-fixture.test.mjs`
