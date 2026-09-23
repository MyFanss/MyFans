# Domain Events

This document describes all domain events published by the backend and how to subscribe to them.

## Overview

The application uses an in-process event bus (`EventsModule`) to publish domain events. All events are delivered synchronously to subscribers within the same process. `EventsModule` is a global module, so any service can inject `EventBus` and subscribe to or publish events.

## Event Bus API

```typescript
import { EventBus } from './events/event-bus';

export class MyService {
  constructor(private readonly eventBus: EventBus) {}

  onMyAction() {
    // Subscribe to an event
    this.eventBus.subscribe('subscription.created', (event) => {
      console.log(`New subscription: ${event.fan} subscribed to ${event.creator}`);
    });

    // Publish an event
    this.eventBus.publish(new SomeEvent(...));
  }
}
```

## Event Catalog

### Authentication Events

#### `UserLoggedInEvent` (`auth.user_logged_in`)

Published when a user successfully authenticates.

```typescript
{
  type: 'auth.user_logged_in',
  userId: string,
  stellarAddress: string,
  timestamp: number,  // milliseconds since epoch
}
```

**Published by:** `AuthService.createSession()`

**Subscribers:** Notifications (email login alert)

---

### Subscription Events

Subscription lifecycle is represented by **distinct** domain events: a first-time subscription emits `subscription.created`, while a subsequent renewal emits `subscription.renewed`. These are never collapsed into a single event — notifications and analytics depend on the distinction (renewals drive MRR; creations drive acquisition).

#### `SubscriptionCreatedEvent` (`subscription.created`)

Published when a fan creates a **new** subscription to a creator's plan. This is the first subscription for the `(fan, creator, planId)` tuple; it is not emitted for renewals.

```typescript
{
  type: 'subscription.created',
  fan: string,              // Fan user ID
  creator: string,          // Creator user ID
  planId: number,           // Plan ID on-chain
  expiry: number,           // Expiration timestamp (unix seconds)
  timestamp: number,        // milliseconds since epoch
}
```

**Published by:** `SubscriptionsService.addSubscription()`, `SubscriptionEventPollerService` (on `subscription_created`)

**Subscribers:** Notifications (welcome/confirmation email), Analytics (new-subscription / acquisition metric)

---

#### `SubscriptionRenewedEvent` (`subscription.renewed`)

Published when an **existing** subscription is renewed (either automatically or manually). Distinct from `subscription.created` so that renewal notifications and MRR analytics are not conflated with new subscriptions.

```typescript
{
  type: 'subscription.renewed',
  subscriptionId: string,   // Internal subscription ID
  fan: string,              // Fan user ID
  creator: string,          // Creator user ID
  planId: number,           // Plan ID on-chain
  expiry: number,           // New expiration timestamp (unix seconds)
  timestamp: number,        // milliseconds since epoch
}
```

**Published by:** `SubscriptionsService.renewSubscription()`, `SubscriptionEventPollerService` (on `subscription_renewed`)

**Subscribers:** Notifications (renewal confirmation), Analytics (renewal / MRR metric)

---

#### `SubscriptionCancelledEvent` (`subscription.cancelled`)

Published when a subscription is explicitly cancelled by the fan or creator.

```typescript
{
  type: 'subscription.cancelled',
  subscriptionId: string,   // Internal subscription ID
  fan: string,              // Fan user ID
  creator: string,          // Creator user ID
  planId: number,           // Plan ID on-chain
  cancelledAt: number,      // Cancellation timestamp (unix seconds)
  timestamp: number,        // milliseconds since epoch
}
```

**Published by:** `SubscriptionsService.cancelSubscription()`

**Subscribers:** Notifications (cancellation email)

---

#### `SubscriptionExpiredEvent` (`subscription.expired`)

Published when a subscription expires (reaches its expiry time).

```typescript
{
  type: 'subscription.expired',
  fan: string,              // Fan user ID
  creator: string,          // Creator user ID
  timestamp: number,        // milliseconds since epoch
}
```

**Published by:** `SubscriptionsService.expireSubscription()`

**Subscribers:** Notifications (expiration notice), Content Access Service (revokes gated content)

---

#### `SubscriptionRenewalFailedEvent` (`subscription.renewal_failed`)

Published when an automatic renewal attempt fails.

```typescript
{
  type: 'subscription.renewal_failed',
  subscriptionId: string,   // Internal subscription ID
  fan: string,              // Fan user ID
  creator: string,          // Creator user ID
  planId: number,           // Plan ID on-chain
  reason?: string,          // Failure reason (e.g., "insufficient_balance")
  timestamp: number,        // milliseconds since epoch
}
```

**Published by:** `SubscriptionEventPollerService` (on renewal sync failure)

**Subscribers:** Notifications (renewal failure alert)

---

### Creator Events

#### `PlanCreatedEvent` (`creator.plan_created`)

Published when a creator creates a new subscription plan.

```typescript
{
  type: 'creator.plan_created',
  planId: number,           // Plan ID on-chain
  creator: string,          // Creator user ID
  asset: string,            // Asset code (e.g., "USDC")
  amount: string,           // Amount per period (as string for precision)
  timestamp: number,        // milliseconds since epoch
}
```

**Published by:** `CreatorsService.createPlan()`

**Subscribers:** Notifications (plan created confirmation), Analytics

---

### Post Events

#### `PostDeletedEvent` (`post.deleted`)

Published when a post is deleted (soft-delete or hard-delete).

```typescript
{
  type: 'post.deleted',
  postId: string,           // Post ID
  deletedBy: string,        // User ID who deleted (creator or admin)
  timestamp: number,        // milliseconds since epoch
}
```

**Published by:** `PostsService.deletePost()`

**Subscribers:** Content service (updates indexes), Notifications

---

### Comment Events

#### `CommentDeletedEvent` (`comment.deleted`)

Published when a comment is deleted.

```typescript
{
  type: 'comment.deleted',
  commentId: string,        // Comment ID
  deletedBy: string,        // User ID who deleted
  timestamp: number,        // milliseconds since epoch
}
```

**Published by:** `CommentsService.deleteComment()`

**Subscribers:** Notifications (comment deleted), Analytics

---

## Subscription Event Poller

The `SubscriptionEventPollerService` polls Soroban contract events and translates them into the domain events above. It is the on-chain source of truth for subscription state and must be safe against duplicate delivery.

### Target events

The poller only processes the following contract topics (`TARGET_EVENTS`):

| Contract topic | Domain event |
| --- | --- |
| `subscription_created` | `subscription.created` |
| `subscription_renewed` | `subscription.renewed` |
| `subscription_cancelled` | `subscription.cancelled` |

Any other topic is ignored. Malformed payloads (missing/incorrectly typed fields) are logged at `WARN` and skipped without advancing the idempotency ledger for that event, so they can be retried after a fix.

### Created vs renewed mapping

The poller maps `subscription_created` to `SubscriptionCreatedEvent` and `subscription_renewed` to `SubscriptionRenewedEvent` — the two are never collapsed. When a `subscription_created` event arrives for a `(fan, creator, planId)` tuple that already has a subscription, the poller treats it as a renewal and emits `SubscriptionRenewedEvent` instead, so downstream consumers always see the correct lifecycle event. Historical events that predate this distinction are backfilled as `subscription.created` only when no prior subscription exists for the tuple; otherwise they are backfilled as `subscription.renewed`.

### Idempotency

Every processed event is keyed by `ledgerSeq:eventIndex` (the idempotency ledger). Before emitting a domain event, the poller checks the ledger and skips events it has already processed, so duplicate delivery from the RPC or overlapping poll windows cannot double-publish. The ledger is only advanced after a domain event is successfully published; failures leave the key unset so the event is retried on the next poll.

### Single-writer rule

The poller is a **proposer**, not a writer. It never mutates subscription status directly. Instead it publishes `subscription.created` / `subscription.renewed` / `subscription.cancelled` domain events, and the `SubscriptionReconcilerService` is the **sole writer** of subscription status. See `backend/docs/adr/0001-subscription-single-writer.md` for the full decision record.

### Cache invalidation

Whenever the reconciler commits an authoritative status change it invalidates the affected `SubscriptionCache` entries (by subscription ID and by the `(fan, creator, planId)` tuple) so readers never observe a stale status. Proposers (poller, checkout) do not touch the cache; only the single writer does, which keeps cache coherence tied to the authoritative write.
