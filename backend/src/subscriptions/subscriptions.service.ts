import { Injectable } from '@nestjs/common';

interface Subscription {
  fan: string;
  creator: string;
  planId: number;
  expiry: number;
}

@Injectable()
export class SubscriptionsService {
  private subscriptions: Map<string, Subscription> = new Map();

  private getKey(fan: string, creator: string): string {
    return `${fan}:${creator}`;
  }

  addSubscription(fan: string, creator: string, planId: number, expiry: number) {
    this.subscriptions.set(this.getKey(fan, creator), { fan, creator, planId, expiry });
  }

  isSubscriber(fan: string, creator: string): boolean {
    const sub = this.subscriptions.get(this.getKey(fan, creator));
    return sub ? sub.expiry > Date.now() / 1000 : false;
  }

  getSubscription(fan: string, creator: string): Subscription | undefined {
    return this.subscriptions.get(this.getKey(fan, creator));
  }
}
