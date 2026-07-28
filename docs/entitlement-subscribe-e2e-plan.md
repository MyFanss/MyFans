# E2E Plan: Subscribe → Entitlement (Payments + Contract Events)

## Problem

Subscribe spans two async sources of truth — the payments flow and on-chain
contract (Soroban) events — with no single end-to-end harness exercising the
full path from "user subscribes" to "entitlement is queryable."

## Scope

Trace one subscription through both spans:

1. **Payments span**: checkout/payment confirmation → `subscription-event-publisher.service.ts`
   emits the internal domain event.
2. **Contract span**: `subscription-event-poller.service.ts` polls Soroban RPC
   ledger events → `subscription-chain-reader.service.ts` / `subscription-chain-sync.service.ts`
   reconcile on-chain state.
3. **Entitlement read**: `subscription-cache.service.ts` / `gated-content.guard.ts`
   must reflect the merged result of both spans.

## Proposed E2E Flow

```
seed fan + creator
  -> trigger payment confirmation (mock payment webhook)
  -> assert domain event published (subscription-event-publisher)
  -> trigger mock RPC ledger event (see mock-rpc below)
  -> assert subscription-event-poller consumes it
  -> assert subscription-chain-reader reconciles state
  -> assert subscription-cache reflects entitlement
  -> assert gated-content.guard allows access
```

## Mock RPC

Use a lightweight fake in place of the live Soroban RPC endpoint so the
harness runs without network access or a funded testnet account. See
`backend/src/subscriptions/__mocks__/soroban-rpc.mock.ts` for the stub
shape — it returns canned ledger events matching the schema consumed by
`subscription-event-poller.service.ts` (`SubscriptionIndexerEventDto`).

## Docs

- This file is the plan of record; implementation should land as
  `backend/test/e2e/subscribe-entitlement.e2e-spec.ts` (not yet created).
- Follow-ups: wire the mock RPC into a test `SorobanRpcService` provider
  override, and assert idempotent replay (duplicate ledger events must not
  double-credit entitlement), mirroring the pattern in
  `backend/src/idempotency/idempotency.service.ts`.

## Out of scope (this pass)

- Real RPC integration / testnet contracts.
- Wiring this plan into CI.
