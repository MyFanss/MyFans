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

#### `SubscriptionCreatedEvent` (`subscription.created`)

Published when a fan creates a new subscription to a creator's plan.

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

**Published by:** `SubscriptionsService.addSubscription()`

**Subscribers:** Notifications (confirmation email), Analytics

---

#### `SubscriptionRenewedEvent` (`subscription.renewed`)

Published when a subscription is renewed (either automatically or manually).

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

**Published by:** `SubscriptionsService.renewSubscription()`

**Subscribers:** Notifications (renewal confirmation)

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

## Metrics

The `EventBus` tracks the following metrics:

- **`events_published_total`**: Total count of all published events (across all types)
- **`events_by_type`**: Per-event-type published count as a map (`{ 'event.type': count, ... }`)

Access metrics via:

```typescript
const bus = module.get<InProcessEventBus>(EventBus);
const metrics = bus.getMetrics();
console.log(metrics.events_published_total);      // e.g., 42
console.log(metrics.events_by_type);              // e.g., { 'subscription.created': 10, ... }
```

## Error Handling

If a subscriber's handler throws an error:
1. The error is logged at `ERROR` level with the handler context
2. Publishing continues to the next handler for that event
3. No exception is propagated to the publisher

This ensures one faulty handler doesn't block other subscribers or break the publishing flow.

## Adding New Events

When adding a new domain event:

1. **Define the event class** in `backend/src/events/domain-events.ts`:
   ```typescript
   export class MyNewEvent {
     readonly type = 'domain.my_new_event' as const;
     constructor(
       public readonly field1: string,
       public readonly timestamp: number = Date.now(),
     ) {}
   }
   ```

2. **Add to the `DomainEvent` union type** in the same file:
   ```typescript
   export type DomainEvent =
     | UserLoggedInEvent
     | SubscriptionCreatedEvent
     | MyNewEvent;  // Add here
   ```

3. **Publish from the appropriate service**:
   ```typescript
   export class MyService {
     constructor(private eventBus: EventBus) {}

     async doSomething() {
       this.eventBus.publish(new MyNewEvent('data'));
     }
   }
   ```

4. **Subscribe in the listening service**:
   ```typescript
   export class NotificationService {
     constructor(private eventBus: EventBus) {
       this.eventBus.subscribe('domain.my_new_event', (event: MyNewEvent) => {
         // Handle the event
       });
     }
   }
   ```

5. **Document the event** in this file (EVENTS.md) under the appropriate category.

## Testing

Unit tests can inject `EventBus` and mock its behavior:

```typescript
const module = await Test.createTestingModule({
  providers: [MyService, { provide: EventBus, useClass: InProcessEventBus }],
}).compile();

const eventBus = module.get(EventBus);
const handler = jest.fn();
eventBus.subscribe('subscription.created', handler);

// ... trigger publisher ...

expect(handler).toHaveBeenCalledWith(expect.objectContaining({ fan: 'xyz' }));
```

See `backend/src/events/events.spec.ts` for examples.
