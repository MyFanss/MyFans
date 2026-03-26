import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  SUBSCRIPTION_EVENT_PUBLISHER,
  SUBSCRIPTION_RENEWAL_FAILED,
} from './events';
import type {
  RenewalFailurePayload,
  SubscriptionEventPublisher,
} from './events';
import { PaginatedResponseDto } from '../common/dto';
import { JobLoggerService } from '../common/services/job-logger.service';
import { EventBus } from '../events/event-bus';
import {
  SubscriptionCreatedEvent,
  SubscriptionExpiredEvent,
} from '../events/domain-events';

/** Checkout status enum */
export enum CheckoutStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

interface Subscription {
  id: string;
  fan: string;
  creator: string;
  planId: number;
  expiry: number;
  status: 'active' | 'expired' | 'cancelled';
  createdAt: Date;
}

interface Checkout {
  id: string;
  fanAddress: string;
  creatorAddress: string;
  planId: number;
  assetCode: string;
  assetIssuer?: string;
  amount: string;
  fee: string;
  total: string;
  status: CheckoutStatus;
  expiresAt: Date;
  txHash?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Plan {
  id: number;
  creator: string;
  asset: string;
  amount: string;
  intervalDays: number;
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

@Injectable()
export class SubscriptionsService {
  private subscriptions: Map<string, Subscription> = new Map();
  private checkouts: Map<string, Checkout> = new Map();
  private checkoutExpiryMinutes = 15;
  private readonly logger = new Logger(SubscriptionsService.name);
  private platformFeeBps = 500;
  private supportedAssets: { code: string; issuer?: string; isNative: boolean }[] = [
    { code: 'XLM', isNative: true },
    { code: 'USDC', issuer: 'GA7Z6G7T3LSSKDAWJH25C4JPLD4PQV4CEMM5S5E6LQD3VDF5W6G6F3K', isNative: false },
  ];
  private creatorProfiles: Map<string, { name: string; description?: string }> = new Map();

  constructor(
    @Optional()
    @Inject(SUBSCRIPTION_EVENT_PUBLISHER)
    private readonly subscriptionEventPublisher?: SubscriptionEventPublisher,
    @Optional()
    private readonly jobLogger?: JobLoggerService,
    @Optional()
    private readonly eventBus?: EventBus,
  ) {
    this.creatorProfiles.set('GAAAAAAAAAAAAAAA', { name: 'Creator 1', description: 'Premium content creator' });
    this.creatorProfiles.set('GBBD47ZY6F6R7OGMW5G6C5R5P6NQ5QW5R5V5S5R5O5P5Q5R5V5S5R5O5', { name: 'Creator 2', description: 'Exclusive videos and photos' });
  }

  private getKey(fan: string, creator: string): string {
    return `${fan}:${creator}`;
  }

  addSubscription(fan: string, creator: string, planId: number, expiry: number) {
    this.subscriptions.set(this.getKey(fan, creator), {
      id: generateId(),
      fan,
      creator,
      planId,
      expiry,
      status: 'active',
      createdAt: new Date(),
    });
    this.eventBus?.publish(new SubscriptionCreatedEvent(fan, creator, planId, expiry));
  }

  expireSubscription(fan: string, creator: string) {
    this.subscriptions.delete(this.getKey(fan, creator));
    this.eventBus?.publish(new SubscriptionExpiredEvent(fan, creator));
  }

  /** Used by reconciler for full-scan access */
  getAllSubscriptionsInternal(): { id: string; fan: string; creator: string; expiry: number; status: string }[] {
    return Array.from(this.subscriptions.values()).map(s => ({
      id: s.id,
      fan: s.fan,
      creator: s.creator,
      expiry: s.expiry,
      status: s.status,
    }));
  }

  isSubscriber(fan: string, creator: string): boolean {
    const sub = this.subscriptions.get(this.getKey(fan, creator));
    return sub ? sub.expiry > Date.now() / 1000 : false;
  }

  getSubscription(fan: string, creator: string): Subscription | undefined {
    return this.subscriptions.get(this.getKey(fan, creator));
  }

  listSubscriptions(fan: string, status?: string, sort?: string, page = 1, limit = 20) {
    let userSubs = Array.from(this.subscriptions.values()).filter(sub => sub.fan === fan);
    const nowSecs = Date.now() / 1000;
    userSubs.forEach(sub => {
      if (sub.status === 'active' && sub.expiry <= nowSecs) sub.status = 'expired';
    });
    if (status) userSubs = userSubs.filter(sub => sub.status === status);

    let results = userSubs.map(sub => {
      const plan = this.getPlanMock(sub.planId);
      const creatorProfile = this.creatorProfiles.get(sub.creator);
      return {
        id: sub.id,
        creatorId: sub.creator,
        creatorName: creatorProfile?.name || 'Unknown Creator',
        creatorUsername: sub.creator.substring(0, 8),
        planName: plan ? `${this.getIntervalText(plan.intervalDays)} Subscription` : 'Subscription',
        price: plan ? parseFloat(plan.amount) : 0,
        currency: plan ? plan.asset.split(':')[0] : 'XLM',
        interval: plan && plan.intervalDays === 30 ? 'month' : plan && plan.intervalDays === 365 ? 'year' : 'month',
        currentPeriodEnd: new Date(sub.expiry * 1000).toISOString(),
        status: sub.status,
        createdAt: sub.createdAt.toISOString(),
      };
    });

    if (sort === 'created') {
      results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      results.sort((a, b) => new Date(a.currentPeriodEnd).getTime() - new Date(b.currentPeriodEnd).getTime());
    }

    const total = results.length;
    const paginatedResults = results.slice((page - 1) * limit, page * limit);
    return new PaginatedResponseDto(paginatedResults, total, page, limit);
  }

  createCheckout(
    fanAddress: string,
    creatorAddress: string,
    planId: number,
    assetCode = 'XLM',
    assetIssuer?: string,
  ): Checkout {
    const plan = this.getPlanMock(planId);
    if (!plan) throw new NotFoundException('Plan not found');

    const amount = plan.amount;
    const fee = this.calculateFee(amount);
    const total = (parseFloat(amount) + parseFloat(fee)).toFixed(7);

    const checkout: Checkout = {
      id: generateId(),
      fanAddress,
      creatorAddress,
      planId,
      assetCode,
      assetIssuer,
      amount,
      fee,
      total,
      status: CheckoutStatus.PENDING,
      expiresAt: new Date(Date.now() + this.checkoutExpiryMinutes * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.checkouts.set(checkout.id, checkout);
    return checkout;
  }

  getCheckout(checkoutId: string): Checkout {
    const checkout = this.checkouts.get(checkoutId);
    if (!checkout) throw new NotFoundException('Checkout not found');
    if (new Date() > checkout.expiresAt) {
      checkout.status = CheckoutStatus.EXPIRED;
      throw new BadRequestException('Checkout session has expired');
    }
    return checkout;
  }

  getPlanSummary(planId: number) {
    const plan = this.getPlanMock(planId);
    if (!plan) throw new NotFoundException('Plan not found');
    const creatorProfile = this.creatorProfiles.get(plan.creator);
    const intervalText = this.getIntervalText(plan.intervalDays);
    const [assetCode, assetIssuer] = plan.asset.split(':');
    return {
      id: plan.id,
      creatorName: creatorProfile?.name || 'Unknown Creator',
      creatorAddress: plan.creator,
      name: `${intervalText} Subscription`,
      description: creatorProfile?.description,
      assetCode,
      assetIssuer,
      amount: plan.amount,
      interval: intervalText,
      intervalDays: plan.intervalDays,
    };
  }

  getPriceBreakdown(checkoutId: string) {
    const checkout = this.getCheckout(checkoutId);
    return {
      subtotal: checkout.amount,
      platformFee: checkout.fee,
      networkFee: '0.00001',
      total: checkout.total,
      currency: checkout.assetCode,
    };
  }

  validateBalance(fanAddress: string, assetCode: string, requiredAmount: string) {
    const balance = this.getMockBalance(fanAddress, assetCode);
    const balanceNum = parseFloat(balance);
    const requiredNum = parseFloat(requiredAmount);
    if (balanceNum >= requiredNum) return { valid: true, balance };
    return { valid: false, balance, shortfall: (requiredNum - balanceNum).toFixed(7) };
  }

  getWalletStatus(fanAddress: string) {
    return {
      address: fanAddress,
      balances: this.supportedAssets.map(asset => ({
        code: asset.code,
        issuer: asset.issuer,
        balance: this.getMockBalance(fanAddress, asset.code),
        isNative: asset.isNative,
      })),
      isConnected: !!fanAddress,
    };
  }

  getTransactionPreview(checkoutId: string) {
    const checkout = this.getCheckout(checkoutId);
    const creatorProfile = this.creatorProfiles.get(checkout.creatorAddress);
    return {
      checkoutId: checkout.id,
      from: checkout.fanAddress,
      to: checkout.creatorAddress,
      asset: { code: checkout.assetCode, issuer: checkout.assetIssuer },
      amount: checkout.amount,
      fee: checkout.fee,
      total: checkout.total,
      memo: `Subscribe to ${creatorProfile?.name || 'creator'}`,
    };
  }

  confirmSubscription(checkoutId: string, txHash?: string) {
    const checkout = this.getCheckout(checkoutId);
    const job = this.jobLogger?.start({
      queue: 'subscriptions',
      jobName: 'confirm-subscription',
      jobId: checkoutId,
    });
    try {
      checkout.status = CheckoutStatus.COMPLETED;
      checkout.txHash = txHash || `tx_${Date.now()}`;
      checkout.updatedAt = new Date();
      const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${checkout.txHash}`;
      this.addSubscription(
        checkout.fanAddress,
        checkout.creatorAddress,
        checkout.planId,
        Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      );
      job?.done();
      return {
        success: true,
        checkoutId: checkout.id,
        status: checkout.status,
        txHash: checkout.txHash,
        explorerUrl,
        message: 'Subscription created successfully!',
      };
    } catch (err) {
      job?.done(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  failCheckout(checkoutId: string, error: string, isRejected = false) {
    const checkout = this.getCheckout(checkoutId);
    const job = this.jobLogger?.start({
      queue: 'subscriptions',
      jobName: 'fail-checkout',
      jobId: checkoutId,
    });
    checkout.status = isRejected ? CheckoutStatus.REJECTED : CheckoutStatus.FAILED;
    checkout.error = error;
    checkout.updatedAt = new Date();
    this.emitRenewalFailureEvent(checkout, error);
    job?.done(new Error(error));
    return {
      success: false,
      checkoutId: checkout.id,
      status: checkout.status,
      error,
      message: isRejected ? 'Transaction was rejected' : 'Transaction failed',
    };
  }

  private calculateFee(amount: string): string {
    return ((parseFloat(amount) * this.platformFeeBps) / 10000).toFixed(7);
  }

  private getIntervalText(days: number): string {
    if (days === 1) return 'Daily';
    if (days === 7) return 'Weekly';
    if (days === 30) return 'Monthly';
    if (days === 365) return 'Yearly';
    return `${days} days`;
  }

  private getMockBalance(_address: string, assetCode: string): string {
    if (assetCode === 'XLM') return '1000.0000000';
    if (assetCode === 'USDC') return '50.0000000';
    return '0.0000000';
  }

  private getPlanMock(planId: number): Plan | undefined {
    const plans: Plan[] = [
      { id: 1, creator: 'GAAAAAAAAAAAAAAA', asset: 'XLM', amount: '10', intervalDays: 30 },
      { id: 2, creator: 'GAAAAAAAAAAAAAAA', asset: 'USDC:GA7Z6G7T3LSSKDJPLAWJH25C4D4PQV4CEMM5S5E6LQD3VDF5W6G6F3K', amount: '5', intervalDays: 30 },
      { id: 3, creator: 'GBBD47ZY6F6R7OGMW5G6C5R5P6NQ5QW5R5V5S5R5O5P5Q5R5V5S5R5O5', asset: 'XLM', amount: '25', intervalDays: 7 },
    ];
    return plans.find(p => p.id === planId);
  }

  private emitRenewalFailureEvent(checkout: Checkout, reason: string): void {
    const payload: RenewalFailurePayload = {
      subscriptionId: checkout.id,
      reason,
      timestamp: new Date().toISOString(),
      userId: checkout.fanAddress,
    };
    Promise.resolve()
      .then(() => this.subscriptionEventPublisher?.emit(SUBSCRIPTION_RENEWAL_FAILED, payload))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to emit renewal failure event: ${message}`);
      });
  }
}
