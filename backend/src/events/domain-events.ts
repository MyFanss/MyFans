// Auth events
export class UserLoggedInEvent {
  readonly type = 'auth.user_logged_in' as const;
  constructor(
    public readonly userId: string,
    public readonly stellarAddress: string,
    public readonly timestamp: number = Date.now(),
  ) {}
}

// Subscription events
export class SubscriptionCreatedEvent {
  readonly type = 'subscription.created' as const;
  constructor(
    public readonly fan: string,
    public readonly creator: string,
    public readonly planId: number,
    public readonly expiry: number,
    public readonly timestamp: number = Date.now(),
  ) {}
}

export class SubscriptionRenewedEvent {
  readonly type = 'subscription.renewed' as const;
  constructor(
    public readonly subscriptionId: string,
    public readonly fan: string,
    public readonly creator: string,
    public readonly planId: number,
    public readonly expiry: number,
    public readonly timestamp: number = Date.now(),
  ) {}
}

export class SubscriptionCancelledEvent {
  readonly type = 'subscription.cancelled' as const;
  constructor(
    public readonly subscriptionId: string,
    public readonly fan: string,
    public readonly creator: string,
    public readonly planId: number,
    public readonly cancelledAt: number = Date.now(),
    public readonly timestamp: number = Date.now(),
  ) {}
}

export class SubscriptionExpiredEvent {
  readonly type = 'subscription.expired' as const;
  constructor(
    public readonly fan: string,
    public readonly creator: string,
    public readonly timestamp: number = Date.now(),
  ) {}
}

// Creator events
export class PlanCreatedEvent {
  readonly type = 'creator.plan_created' as const;
  constructor(
    public readonly planId: number,
    public readonly creator: string,
    public readonly asset: string,
    public readonly amount: string,
    public readonly timestamp: number = Date.now(),
  ) {}
}

// Post events
export class PostDeletedEvent {
  readonly type = 'post.deleted' as const;
  constructor(
    public readonly postId: string,
    public readonly deletedBy: string,
    public readonly timestamp: number = Date.now(),
  ) {}
}

export type DomainEvent =
  | UserLoggedInEvent
  | SubscriptionCreatedEvent
  | SubscriptionRenewedEvent
  | SubscriptionCancelledEvent
  | SubscriptionExpiredEvent
  | PlanCreatedEvent
  | PostDeletedEvent;
