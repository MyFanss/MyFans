import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PaginatedResponseDto } from '../common/dto';
import { isStellarAccountAddress } from '../common/utils/stellar-address';
import { EventBus } from '../events/event-bus';
import {
  SubscriptionCancelledEvent,
  SubscriptionCreatedEvent,
  SubscriptionExpiredEvent,
  SubscriptionRenewedEvent,
} from '../events/domain-events';
import {
  RenewalFailurePayload,
  SUBSCRIPTION_EVENT_PUBLISHER,
  SUBSCRIPTION_RENEWAL_FAILED,
} from './events';
import type { SubscriptionEventPublisher } from './events';
import { SubscriptionChainReaderService } from './subscription-chain-reader.service';

export enum CheckoutStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export const SERVER_NETWORK = process.env.STELLAR_NETWORK ?? 'testnet';

interface Subscription {
  id: string;
  fan: string;
  creator: string;
  planId: number;
  expiry: number;
  status: 'active' | 'expired' | 'cancelled';
  createdAt: Date;
  updatedAt?: Date;
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
  updatedAt?: Date;
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
  private readonly subscriptions: Map<string, Subscription> = new Map();
  private readonly checkouts: Map<string, Checkout> = new Map();
  private readonly checkoutExpiryMinutes = 15;
  private readonly logger = new Logger(SubscriptionsService.name);
  private readonly platformFeeBps = 500;
  private readonly supportedAssets: {
    code: string;
    issuer?: string;
    isNative: boolean;
  }[] = [
    { code: 'XLM', isNative: true },
    {
      code: 'USDC',
      issuer: 'GA7Z6G7T3LSSKDAWJH25C4JPLD4PQV4CEMM5S5E6LQD3VDF5W6G6F3K',
      isNative: false,
    },
  ];
  private readonly creatorProfiles: Map<
    string,
    { name: string; description?: string }
  > = new Map();

  constructor(
    private readonly eventBus: EventBus,
    @Optional()
    @Inject(SUBSCRIPTION_EVENT_PUBLISHER)
    private readonly subscriptionEventPublisher?: SubscriptionEventPublisher,
    @Optional()
    private readonly chainReader?: SubscriptionChainReaderService,
  ) {
    this.creatorProfiles.set('GAAAAAAAAAAAAAAA', {
      name: 'Creator 1',
      description: 'Premium content creator',
    });
    this.creatorProfiles.set(
      'GBBD47ZY6F6R7OGMW5G6C5R5P6NQ5QW5R5V5S5R5O5P5Q5R5V5S5R5O5',
      { name: 'Creator 2', description: 'Exclusive videos and photos' },
    );
    
    // Initialize default plans
    this.initializePlans();
  }

  private initializePlans(): void {
    const defaultPlans: Plan[] = [
      {
        id: 1,
        creator: 'GAAAAAAAAAAAAAAA',
        asset: 'XLM',
        amount: '10',
        intervalDays: 30,
        updatedAt: new Date(),
      },
      {
        id: 2,
        creator: 'GAAAAAAAAAAAAAAA',
        asset: 'USDC:GA7Z6G7T3LSSKDJPLAWJH25C4D4PQV4CEMM5S5E6LQD3VDF5W6G6F3K',
        amount: '5',
        intervalDays: 30,
        updatedAt: new Date(),
      },
      {
        id: 3,
        creator:
          'GBBD47ZY6F6R7OGMW5G6C5R5P6NQ5QW5R5V5S5R5O5P5Q5R5V5S5R5O5',
        asset: 'XLM',
        amount: '25',
        intervalDays: 7,
        updatedAt: new Date(),
      },
    ];
    
    defaultPlans.forEach(plan => this.plans.set(plan.id, plan));
  }

  assertNetworkMatch(requestNetwork: string | undefined): void {
    if (!requestNetwork) return;
    const normalised = requestNetwork.trim().toLowerCase();
    if (normalised !== SERVER_NETWORK.toLowerCase()) {
      throw new HttpException(
        {
          error: 'NETWORK_MISMATCH',
          message: 'Wallet network does not match server network',
          expectedNetwork: SERVER_NETWORK,
          currentNetwork: requestNetwork,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private getKey(fan: string, creator: string): string {
    return `${fan}:${creator}`;
  }

  addSubscription(
    fan: string,
    creator: string,
    planId: number,
    expiry: number,
  ) {
    const subscription: Subscription = {
      id: generateId(),
      fan,
      creator,
      planId,
      expiry,
      status: expiry > Date.now() / 1000 ? 'active' : 'expired',
      createdAt: new Date(),
    };

    this.subscriptions.set(this.getKey(fan, creator), subscription);
    this.eventBus.publish(
      new SubscriptionCreatedEvent(fan, creator, planId, expiry),
    );

    return subscription;
  }

  renewSubscription(
    fan: string,
    creator: string,
    planId: number,
    expiry: number,
  ) {
    const key = this.getKey(fan, creator);
    const existing = this.subscriptions.get(key);

    if (!existing) {
      return this.addSubscription(fan, creator, planId, expiry);
    }

    existing.planId = planId;
    existing.expiry = expiry;
    existing.status = 'active';

    this.eventBus.publish(
      new SubscriptionRenewedEvent(
        existing.id,
        fan,
        creator,
        planId,
        expiry,
      ),
    );

    return existing;
  }

  expireSubscription(fan: string, creator: string) {
    const key = this.getKey(fan, creator);
    const existing = this.subscriptions.get(key);
    if (existing) {
      existing.status = 'expired';
    }

    this.eventBus.publish(new SubscriptionExpiredEvent(fan, creator));
  }

  cancelSubscription(fan: string, creator: string) {
    const subscription = this.subscriptions.get(this.getKey(fan, creator));
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    subscription.status = 'cancelled';
    subscription.expiry = Math.floor(Date.now() / 1000);

    this.eventBus.publish(
      new SubscriptionCancelledEvent(
        subscription.id,
        fan,
        creator,
        subscription.planId,
      ),
    );

    return {
      success: true,
      subscriptionId: subscription.id,
      fan,
      creator,
      status: subscription.status,
      cancelledAt: new Date().toISOString(),
      message: 'Subscription cancelled successfully',
    };
  }

  isSubscriber(fan: string, creator: string): boolean {
    const sub = this.subscriptions.get(this.getKey(fan, creator));
    return sub ? sub.expiry > Date.now() / 1000 : false;
  }

  getSubscription(fan: string, creator: string): Subscription | undefined {
    return this.subscriptions.get(this.getKey(fan, creator));
  }

  async getFanCreatorSubscriptionState(fan: string, creator: string) {
    if (fan === creator) {
      throw new BadRequestException(
        'creator must be different from the authenticated fan address',
      );
    }
    if (!isStellarAccountAddress(creator)) {
      throw new BadRequestException('creator must be a valid Stellar G-address');
    }

    const active = this.isSubscriber(fan, creator);
    const sub = this.getSubscription(fan, creator);
    const nowSec = Math.floor(Date.now() / 1000);

    let indexedStatus: 'none' | 'active' | 'expired' = 'none';
    let indexed: {
      subscriptionId: string;
      planId: number;
      status: Subscription['status'];
      expiresAt: string;
      expiresAtUnix: number;
      createdAt: string;
    } | null = null;

    if (sub) {
      if (sub.status === 'cancelled') {
        indexedStatus = 'expired';
      } else if (sub.expiry > nowSec && sub.status === 'active') {
        indexedStatus = 'active';
      } else {
        indexedStatus = 'expired';
      }
      indexed = {
        subscriptionId: sub.id,
        planId: sub.planId,
        status: sub.status,
        expiresAt: new Date(sub.expiry * 1000).toISOString(),
        expiresAtUnix: sub.expiry,
        createdAt: sub.createdAt.toISOString(),
      };
    }

    const contractId = this.chainReader?.getConfiguredContractId();
    let chain: {
      configured: boolean;
      isSubscriber: boolean | null;
      error?: string;
    };

    if (!contractId || !this.chainReader) {
      chain = { configured: false, isSubscriber: null };
    } else {
      const result = await this.chainReader.readIsSubscriber(
        contractId,
        fan,
        creator,
      );
      chain = result.ok
        ? { configured: true, isSubscriber: result.isSubscriber }
        : { configured: true, isSubscriber: null, error: result.error };
    }

    return {
      fan,
      creator,
      active,
      indexedStatus,
      indexed,
      chain,
    };
  }

  getFanDashboardSummary(
    fan: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const nowSecs = Date.now() / 1000;
    const activeSubs = Array.from(this.subscriptions.values()).filter(
      (sub) => sub.fan === fan && sub.status === 'active' && sub.expiry > nowSecs,
    );

    activeSubs.sort((a, b) => a.expiry - b.expiry);

    const total = activeSubs.length;
    const paginated = activeSubs.slice((page - 1) * limit, page * limit);

    const subscriptions = paginated.map((sub) => {
      const plan = this.getPlanMock(sub.planId);
      const creatorProfile = this.creatorProfiles.get(sub.creator);
      return {
        id: sub.id,
        creatorId: sub.creator,
        creatorName: creatorProfile?.name ?? 'Unknown Creator',
        planName: plan
          ? `${this.getIntervalText(plan.intervalDays)} Subscription`
          : 'Subscription',
        price: plan ? parseFloat(plan.amount) : 0,
        currency: plan ? plan.asset.split(':')[0] : 'XLM',
        interval:
          plan?.intervalDays === 365
            ? 'year'
            : plan?.intervalDays === 7
              ? 'week'
              : 'month',
        renewsAt: new Date(sub.expiry * 1000).toISOString(),
        renewsAtUnix: sub.expiry,
        status: sub.status,
        createdAt: sub.createdAt.toISOString(),
      };
    });

    return {
      fan,
      totalActive: total,
      subscriptions,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  listSubscriptions(
    fan: string,
    status?: string,
    sort?: string,
    page: number = 1,
    limit: number = 20,
  ) {
    let userSubs = Array.from(this.subscriptions.values()).filter(
      (sub) => sub.fan === fan,
    );

    const nowSecs = Date.now() / 1000;
    userSubs.forEach((sub) => {
      if (sub.status === 'active' && sub.expiry <= nowSecs) {
        sub.status = 'expired';
      }
    });

    if (status) {
      userSubs = userSubs.filter((sub) => sub.status === status);
    }

    const results = userSubs.map((sub) => {
      const plan = this.getPlanMock(sub.planId);
      const creatorProfile = this.creatorProfiles.get(sub.creator);

      return {
        id: sub.id,
        creatorId: sub.creator,
        creatorName: creatorProfile?.name || 'Unknown Creator',
        creatorUsername: sub.creator.substring(0, 8),
        planName: plan
          ? `${this.getIntervalText(plan.intervalDays)} Subscription`
          : 'Subscription',
        price: plan ? parseFloat(plan.amount) : 0,
        currency: plan ? plan.asset.split(':')[0] : 'XLM',
        interval:
          plan && plan.intervalDays === 30
            ? 'month'
            : plan && plan.intervalDays === 365
              ? 'year'
              : 'month',
        currentPeriodEnd: new Date(sub.expiry * 1000).toISOString(),
        status: sub.status,
        createdAt: sub.createdAt.toISOString(),
      };
    });

    if (sort === 'created') {
      results.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } else {
      results.sort(
        (a, b) =>
          new Date(a.currentPeriodEnd).getTime() -
          new Date(b.currentPeriodEnd).getTime(),
      );
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
    requestNetwork?: string,
  ): Checkout {
    this.assertNetworkMatch(requestNetwork);

    const plan = this.getPlanMock(planId);
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

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
      expiresAt: new Date(
        Date.now() + this.checkoutExpiryMinutes * 60 * 1000,
      ),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.checkouts.set(checkout.id, checkout);
    return checkout;
  }

  getCheckout(checkoutId: string): Checkout {
    const checkout = this.checkouts.get(checkoutId);
    if (!checkout) {
      throw new NotFoundException('Checkout not found');
    }

    if (new Date() > checkout.expiresAt) {
      checkout.status = CheckoutStatus.EXPIRED;
      throw new BadRequestException('Checkout session has expired');
    }

    return checkout;
  }

  getPlanSummary(planId: number) {
    const plan = this.getPlanMock(planId);
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    const creatorProfile = this.creatorProfiles.get(plan.creator);
    const intervalText = this.getIntervalText(plan.intervalDays);
    const assetParts = plan.asset.split(':');
    const assetCode = assetParts[0];
    const assetIssuer = assetParts[1] || undefined;

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

  validateBalance(
    fanAddress: string,
    assetCode: string,
    requiredAmount: string,
  ): { valid: boolean; balance: string; shortfall?: string } {
    const balance = this.getMockBalance(fanAddress, assetCode);
    const balanceNum = parseFloat(balance);
    const requiredNum = parseFloat(requiredAmount);

    if (balanceNum >= requiredNum) {
      return { valid: true, balance };
    }

    return {
      valid: false,
      balance,
      shortfall: (requiredNum - balanceNum).toFixed(7),
    };
  }

  getWalletStatus(fanAddress: string) {
    return {
      address: fanAddress,
      balances: this.supportedAssets.map((asset) => ({
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
    const existingSubscription = this.getSubscription(
      checkout.fanAddress,
      checkout.creatorAddress,
    );

    checkout.status = CheckoutStatus.COMPLETED;
    checkout.txHash = txHash || `tx_${Date.now()}`;
    checkout.updatedAt = new Date();

    const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${checkout.txHash}`;
    const expiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    const subscription = existingSubscription
      ? this.renewSubscription(
          checkout.fanAddress,
          checkout.creatorAddress,
          checkout.planId,
          expiry,
        )
      : this.addSubscription(
          checkout.fanAddress,
          checkout.creatorAddress,
          checkout.planId,
          expiry,
        );

    return {
      success: true,
      checkoutId: checkout.id,
      status: checkout.status,
      txHash: checkout.txHash,
      explorerUrl,
      subscriptionId: subscription.id,
      lifecycleEvent: existingSubscription ? 'renewed' : 'created',
      message: existingSubscription
        ? 'Subscription renewed successfully!'
        : 'Subscription created successfully!',
    };
  }

  failCheckout(
    checkoutId: string,
    error: string,
    isRejected: boolean = false,
  ) {
    const checkout = this.getCheckout(checkoutId);

    checkout.status = isRejected
      ? CheckoutStatus.REJECTED
      : CheckoutStatus.FAILED;
    checkout.error = error;
    checkout.updatedAt = new Date();
    this.emitRenewalFailureEvent(checkout, error);

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

  private getMockBalance(address: string, assetCode: string): string {
    void address;
    if (assetCode === 'XLM') return '1000.0000000';
    if (assetCode === 'USDC') return '50.0000000';
    return '0.0000000';
  }

  private getPlanMock(planId: number): Plan | undefined {
    const plans: Plan[] = [
      { id: 1, creator: 'GAAAAAAAAAAAAAAA', asset: 'XLM', amount: '10', intervalDays: 30 },
      {
        id: 2,
        creator: 'GAAAAAAAAAAAAAAA',
        asset: 'USDC:GA7Z6G7T3LSSKDJPLAWJH25C4D4PQV4CEMM5S5E6LQD3VDF5W6G6F3K',
        amount: '5',
        intervalDays: 30,
      },
      {
        id: 3,
        creator: 'GBBD47ZY6F6R7OGMW5G6C5R5P6NQ5QW5R5V5S5R5O5P5Q5R5V5S5R5O5',
        asset: 'XLM',
        amount: '25',
        intervalDays: 7,
      },
    ];
    return plans.find((p) => p.id === planId);
  }

  /** Returns completed checkouts for analytics aggregation. */
  getCompletedPayments(): Checkout[] {
    return Array.from(this.checkouts.values()).filter(
      (c) => c.status === CheckoutStatus.COMPLETED,
    );
  }

  /**
   * Renew an existing subscription
   * Requires fan authentication (caller must be the fan)
   * Reuses fee split logic from checkout flow
   * @param fanAddress - Address of the fan renewing (must match authenticated user)
   * @param creatorAddress - Address of the creator
   * @param planId - ID of the plan to renew
   * @param txHash - Optional transaction hash for the renewal payment
   * @returns Renewal confirmation with updated expiry
   * @throws Error if subscription not found, fan not authenticated, or plan not found
   */
  renewSubscription(
    fanAddress: string,
    creatorAddress: string,
    planId: number,
    txHash?: string,
  ): {
    success: boolean;
    subscriptionId: string;
    newExpiryTimestamp: number;
    newExpiryDate: string;
    planId: number;
    txHash?: string;
    message: string;
  } {
    // Check if subscription exists
    const existingSubscription = this.getSubscription(fanAddress, creatorAddress);
    if (!existingSubscription) {
      throw new NotFoundException(
        `No active subscription found for fan ${fanAddress} with creator ${creatorAddress}`,
      );
    }

    // Verify plan exists
    const plan = this.getPlan(planId);
    if (!plan) {
      throw new NotFoundException(`Plan ${planId} not found`);
    }

    // Verify plan belongs to the creator
    if (plan.creator !== creatorAddress) {
      throw new BadRequestException(
        'Plan does not belong to the specified creator',
      );
    }

    // Calculate new expiry using the helper
    const newExpiry = this.calculateExpiryTimestamp(plan.intervalDays);

    // Update the subscription with new expiry
    const key = this.getKey(fanAddress, creatorAddress);
    const updatedSubscription: Subscription = {
      ...existingSubscription,
      expiry: newExpiry,
      updatedAt: new Date(),
    };

    this.subscriptions.set(key, updatedSubscription);

    // Emit renewal event
    this.eventBus.publish(
      new SubscriptionCreatedEvent(fanAddress, creatorAddress, planId, newExpiry),
    );

    this.logger.log(
      `Subscription renewed for fan ${fanAddress} with creator ${creatorAddress}, new expiry: ${newExpiry}`,
    );

    return {
      success: true,
      subscriptionId: existingSubscription.id,
      newExpiryTimestamp: newExpiry,
      newExpiryDate: new Date(newExpiry * 1000).toISOString(),
      planId,
      txHash,
      message: 'Subscription renewed successfully',
    };
  }

  private emitRenewalFailureEvent(checkout: Checkout, reason: string): void {
    const payload: RenewalFailurePayload = {
      subscriptionId: checkout.id,
      reason,
      timestamp: new Date().toISOString(),
      userId: checkout.fanAddress,
    };

    Promise.resolve()
      .then(() =>
        this.subscriptionEventPublisher?.emit(
          SUBSCRIPTION_RENEWAL_FAILED,
          payload,
        ),
      )
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to emit renewal failure event: ${message}`);
      });
  }
}
