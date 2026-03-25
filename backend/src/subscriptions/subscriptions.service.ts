import { Injectable } from '@nestjs/common';
import { EventBus } from '../events/event-bus';
import { SubscriptionCreatedEvent, SubscriptionExpiredEvent } from '../events/domain-events';

interface Subscription {
  fan: string;
  creator: string;
  planId: number;
  expiry: number;
}

@Injectable()
export class SubscriptionsService {
  private subscriptions: Map<string, Subscription> = new Map();

  constructor(private readonly eventBus: EventBus) {}

  private getKey(fan: string, creator: string): string {
    return `${fan}:${creator}`;
  }

  addSubscription(fan: string, creator: string, planId: number, expiry: number) {
    this.subscriptions.set(this.getKey(fan, creator), { fan, creator, planId, expiry });

    this.eventBus.publish(
      new SubscriptionCreatedEvent(fan, creator, planId, expiry),
    );
  }

  expireSubscription(fan: string, creator: string) {
    this.subscriptions.delete(this.getKey(fan, creator));

    this.eventBus.publish(
      new SubscriptionExpiredEvent(fan, creator),
    );
  }

  isSubscriber(fan: string, creator: string): boolean {
    const sub = this.subscriptions.get(this.getKey(fan, creator));
    return sub ? sub.expiry > Date.now() / 1000 : false;
  }

  getSubscription(fan: string, creator: string): Subscription | undefined {
    return this.subscriptions.get(this.getKey(fan, creator));
  }
}
