import {
  Injectable,
  Logger,
  Optional,
  Inject,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { EventBus } from '../events/event-bus';
import {
  SubscriptionCreatedEvent,
  SubscriptionExpiredEvent,
} from '../events/domain-events';
import type { SubscriptionEventPublisher } from './events';
import {
  SUBSCRIPTION_EVENT_PUBLISHER,
  SUBSCRIPTION_RENEWAL_FAILED,
  RenewalFailurePayload,
} from './events';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { isStellarAccountAddress } from '../common/utils/stellar-address';
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

  private supportedAssets: {
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

  private creatorProfiles: Map<
    string,
    { name: string; description?: string }
  > = new Map();

  constructor(
    private readonly eventBus: EventBus,
    @Optional()
    @Inject(SUBSCRIPTION_EVENT_PUBLISHER)
    private readonly subscriptionEventPublisher?: SubscriptionEventPublisher,
    private readonly chainReader: SubscriptionChainReaderService,
  ) {
    this.creatorProfiles.set('GAAAAAAAAAAAAAAA', {
      name: 'Creator 1',
      description: 'Premium content creator',
    });
    this.creatorProfiles.set(
      'GBBD47ZY6F6R7OGMW5G6C5R5P6NQ5QW5R5V5S5R5O5P5Q5R5V5S5R5O5',
      { name: 'Creator 2', description: 'Exclusive videos and photos' },
    );
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
    const id = generateId();
    this.subscriptions.set(this.getKey(fan, creator), {
      id,
      fan,
      creator,
      planId,
      expiry,
      status: 'active',
      createdAt: new Date(),
    });

    this.eventBus.publish(
      new SubscriptionCreatedEvent(fan, creator, planId, expiry),
    );
  }

  expireSubscription(fan: string, creator: string) {
    this.subscriptions.delete(this.getKey(fan, creator));

    this.eventBus.publish(new SubscriptionExpiredEvent(fan, creator));
  }

  isSubscriber(fan: string, creator: string): boolean {
    const sub = this.subscriptions.get(this.getKey(fan, creator));
    return sub ? sub.expiry > Date.now() / 1000 : false;
  }

  getSubscription(fan: string, creator: string): Subscription | undefined {
    return this.subscriptions.get(this.getKey(fan, creator));
  }

  /**
   * Fan–creator subscription state: in-memory index used by checkout flows, plus
   * optional on-chain `is_subscriber` when a subscription contract id is configured
   * (`CONTRACT_ID_SUBSCRIPTION` or `CONTRACT_ID_MYFANS`).
   */
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

    const contractId = this.chainReader.getConfiguredContractId();
    let chain: {
      configured: boolean;
      isSubscriber: boolean | null;
      error?: string;
    };
    if (!contractId) {
      chain = { configured: false, isSubscriber: null };
    } else {
      const r = await this.chainReader.readIsSubscriber(
        contractId,
        fan,
        creator,
      );
      chain = r.ok
        ? { configured: true, isSubscriber: r.isSubscriber }
        : { configured: true, isSubscriber: null, error: r.error };
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
    if (status) userSubs = userSubs.filter(sub => sub.status === status);

    if (status) {
      userSubs = userSubs.filter((sub) => sub.status === status);
    }

    let results = userSubs.map((sub) => {
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
    if (!plan) throw new NotFoundException('Plan not found');
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
    if (balanceNum >= requiredNum) return { valid: true, balance };
    return { valid: false, balance, shortfall: (requiredNum - balanceNum).toFixed(7) };
  }

  getWalletStatus(fanAddress: string) {
    const balances = this.supportedAssets.map((asset) => ({
      code: asset.code,
      issuer: asset.issuer,
      balance: this.getMockBalance(fanAddress, asset.code),
      isNative: asset.isNative,
    }));

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

    checkout.status = CheckoutStatus.COMPLETED;
    checkout.txHash = txHash || `tx_${Date.now()}`;
    checkout.updatedAt = new Date();

    const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${checkout.txHash}`;

    const plan = this.getPlanMock(checkout.planId);
    const intervalDays = plan?.intervalDays ?? 30;
    const expiry = this.calculateExpiryTimestamp(intervalDays);

    this.addSubscription(
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
      message: 'Subscription created successfully!',
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
      error: error,
      message: isRejected
        ? 'Transaction was rejected'
        : 'Transaction failed',
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
      {
        id: 1,
        creator: 'GAAAAAAAAAAAAAAA',
        asset: 'XLM',
        amount: '10',
        intervalDays: 30,
      },
      {
        id: 2,
        creator: 'GAAAAAAAAAAAAAAA',
        asset: 'USDC:GA7Z6G7T3LSSKDJPLAWJH25C4D4PQV4CEMM5S5E6LQD3VDF5W6G6F3K',
        amount: '5',
        intervalDays: 30,
      },
      {
        id: 3,
        creator:
          'GBBD47ZY6F6R7OGMW5G6C5R5P6NQ5QW5R5V5S5R5O5P5Q5R5V5S5R5O5',
        asset: 'XLM',
        amount: '25',
        intervalDays: 7,
      },
    ];
    return plans.find((p) => p.id === planId);
  }

  /**
   * Calculate subscription expiry timestamp in seconds
   * Prevents overflow by checking for max safe integer
   * @param intervalDays - Number of days for the subscription interval
   * @returns Unix timestamp in seconds when subscription expires
   * @throws Error if calculation would overflow
   */
  private calculateExpiryTimestamp(intervalDays: number): number {
    const nowSec = Math.floor(Date.now() / 1000);
    const intervalSec = intervalDays * 24 * 60 * 60;
    
    // Check for overflow: ensure result doesn't exceed max safe integer
    if (nowSec > Number.MAX_SAFE_INTEGER - intervalSec) {
      throw new Error('Expiry calculation would overflow');
    }
    
    return nowSec + intervalSec;
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
        const message =
          error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to emit renewal failure event: ${message}`);
      });
  }
}
