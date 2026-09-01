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
import { LedgerClockService } from './ledger-clock.service';
import {
  SubscriptionCancelledEvent,
  SubscriptionCreatedEvent,
  SubscriptionExpiredEvent,
  SubscriptionRenewedEvent,
} from '../events/domain-events';
import {
  SUBSCRIPTION_CANCELLED,
  SUBSCRIPTION_CREATED,
  SUBSCRIPTION_EVENT_PUBLISHER,
  SUBSCRIPTION_RENEWAL_FAILED,
} from './events';
import type { SubscriptionEventPayload, SubscriptionEventPublisher } from './events';
import { RPC_BALANCE_ADAPTER } from './rpc-adapter';
import type { RpcBalanceAdapter } from './rpc-adapter';
import { SubscriptionChainReaderService } from './subscription-chain-reader.service';
import { SubscriptionIndexRepository } from './repositories/subscription-index.repository';
import { SubscriptionIndexEntity, SubscriptionStatus } from './entities/subscription-index.entity';
import { rpc } from '@stellar/stellar-sdk';
import { SorobanRpcService } from '../common/services/soroban-rpc.service';
import { SubscriptionCacheService } from './subscription-cache.service';

export enum CheckoutStatus {
  PENDING = 'pending',
  /** Chain-verified via RPC, but not yet reflected in the subscription index. */
  CONFIRMED_ON_CHAIN = 'confirmed_on_chain',
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
  status: SubscriptionStatus;
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

type SubscriberListStatus = 'active' | 'expired';

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

@Injectable()
export class SubscriptionsService {
  private readonly checkouts: Map<string, Checkout> = new Map();
  private readonly plans: Map<number, Plan> = new Map();
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
    private readonly indexRepo: SubscriptionIndexRepository,
    private readonly eventBus: EventBus,
    @Inject(RPC_BALANCE_ADAPTER)
    private readonly rpcAdapter: RpcBalanceAdapter,
    @Optional()
    @Inject(SUBSCRIPTION_EVENT_PUBLISHER)
    private readonly subscriptionEventPublisher?: SubscriptionEventPublisher,
    @Optional()
    private readonly chainReader?: SubscriptionChainReaderService,
    @Optional()
    private readonly soroban?: SorobanRpcService,
    @Optional()
    private readonly cache?: SubscriptionCacheService,
    @Optional()
    private readonly ledgerClock?: LedgerClockService,
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
    defaultPlans.forEach((plan) => this.plans.set(plan.id, plan));
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

  private getExpiryStatus(expiryUnix: number): SubscriptionStatus {
    const now = Math.floor(Date.now() / 1000);
    return expiryUnix > now ? SubscriptionStatus.ACTIVE : SubscriptionStatus.EXPIRED;
  }

  async addSubscription(
    fan: string,
    creator: string,
    planId: number,
    expiry: number,
    ledgerSeq?: number,
  ): Promise<SubscriptionIndexEntity> {
    const status = this.getExpiryStatus(expiry);
    const upsertData = {
      fan,
      creator,
      planId,
      expiryUnix: expiry,
      status,
      ledgerSeq,
    } as const;
    const sub = await this.indexRepo.upsertManual(upsertData);
    this.cache?.invalidate(fan, creator);
    this.eventBus.publish(
      new SubscriptionCreatedEvent(fan, creator, planId, expiry),
    );
    this.emitSubscriptionLifecycleEvent(SUBSCRIPTION_CREATED, {
      subscriptionId: sub.id,
      fan,
      creator,
      planId,
      timestamp: new Date().toISOString(),
    });
    return sub;
  }

  async renewSubscription(
    fan: string,
    creator: string,
    planId: number,
    expiry?: number,
    ledgerSeq?: number,
  ): Promise<SubscriptionIndexEntity> {
    const plan = this.getRequiredPlan(planId);
    if (plan.creator !== creator) {
      throw new BadRequestException(
        'Plan does not belong to the specified creator',
      );
    }

    const nextExpiry = expiry ?? this.calculateExpiryTimestamp(plan.intervalDays);
    const status = this.getExpiryStatus(nextExpiry);
    const upsertData = {
      fan,
      creator,
      planId,
      expiryUnix: nextExpiry,
      status,
      ledgerSeq,
    } as const;
    const sub = await this.indexRepo.upsertManual(upsertData);
    this.cache?.invalidate(fan, creator);
    this.eventBus.publish(
      new SubscriptionRenewedEvent(
        sub.id,
        fan,
        creator,
        planId,
        nextExpiry,
      ),
    );
    return sub;
  }

  /**
   * `minLedgerSeq`, when provided, guards against overwriting a row that
   * chain events have already advanced past (see reconciler usage).
   */
  async expireSubscription(fan: string, creator: string, minLedgerSeq?: number) {
    await this.indexRepo.updateStatus(
      fan,
      creator,
      SubscriptionStatus.EXPIRED,
      undefined,
      minLedgerSeq,
    );
    this.cache?.invalidate(fan, creator);
    this.eventBus.publish(new SubscriptionExpiredEvent(fan, creator));
  }

  async cancelSubscription(fan: string, creator: string, minLedgerSeq?: number) {
    const now = Math.floor(Date.now() / 1000);
    const existing = await this.getSubscription(fan, creator);
    if (!existing) {
      throw new NotFoundException('Subscription not found');
    }

    await this.indexRepo.updateStatus(
      fan,
      creator,
      SubscriptionStatus.CANCELLED,
      now,
      minLedgerSeq,
    );
    this.cache?.invalidate(fan, creator);

    this.eventBus.publish(
      new SubscriptionCancelledEvent(
        existing.id,
        fan,
        creator,
        existing.planId,
      ),
    );
    this.emitSubscriptionLifecycleEvent(SUBSCRIPTION_CANCELLED, {
      subscriptionId: existing.id,
      fan,
      creator,
      planId: existing.planId,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      subscriptionId: existing.id,
      fan,
      creator,
      status: SubscriptionStatus.CANCELLED,
      cancelledAt: new Date().toISOString(),
      message: 'Subscription cancelled successfully',
    };
  }

  /**
   * Checks if a fan has an active subscription to a creator.
   *
   * **Resolution order:**
   * 1. Check index (fast, local; may lag chain state)
   * 2. If index says no: simulate is_subscriber on-chain via RPC
   * 3. Cache positive results (1 min TTL) to avoid hammering RPC
   *
   * **Failure behavior:**
   * - Index read failures are logged and treated as "no subscription"
   * - Chain read failures are logged; index status is used as fallback
   * - Returns typed error via `chain.error` in getFanCreatorSubscriptionState if needed
   */
  async isSubscriber(fan: string, creator: string): Promise<boolean> {
    // Check cache first (only cached positives)
    if (this.cache?.get(fan, creator)) {
      return true;
    }

    // Check index
    const indexedActive = await this.indexRepo.isSubscriber(fan, creator);
    if (indexedActive) {
      return true;
    }

    // Index says no; check chain
    const contractId = this.chainReader?.getConfiguredContractId();
    if (!contractId || !this.chainReader) {
      return false;
    }

    try {
      const result = await this.chainReader.readIsSubscriber(
        contractId,
        fan,
        creator,
      );
      if (result.ok && result.isSubscriber) {
        this.cache?.set(fan, creator);
        return true;
      }
      return false;
    } catch (err) {
      this.logger.warn(`isSubscriber chain read error: ${err}`);
      return false;
    }
  }

  /** Returns the distinct creator IDs the fan currently holds an active subscription to. */
  async getActiveCreatorIdsForFan(fan: string): Promise<string[]> {
    const subs = await this.indexRepo.listActiveForFan(fan, 1, 1000);
    return [...new Set(subs.map((sub) => sub.creator))];
  }

  async getSubscription(
    fan: string,
    creator: string,
  ): Promise<SubscriptionIndexEntity | null> {
    return this.indexRepo.findCurrentForFanCreator(fan, creator);
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

    const active = await this.isSubscriber(fan, creator);
    const sub = await this.getSubscription(fan, creator);

    // Use ledger time for consistency with on-chain gating logic.
    let nowSec: number;
    try {
      if (this.ledgerClock) {
        const snapshot = await this.ledgerClock.fetchSnapshot();
        nowSec = this.ledgerClock.ledgerNowUnix(snapshot);
      } else {
        nowSec = Math.floor(Date.now() / 1000);
      }
    } catch (clockErr) {
      this.logger.warn(`Failed to fetch ledger clock: ${clockErr}. Using wall clock.`);
      nowSec = Math.floor(Date.now() / 1000);
    }

    let indexedStatus: 'none' | 'active' | 'expired' = 'none';
    let indexed: {
      subscriptionId: string;
      planId: number;
      status: string;
      expiresAt: string;
      expiresAtUnix: number;
      createdAt: string;
    } | null = null;

    if (sub) {
      if (sub.status === SubscriptionStatus.CANCELLED) {
        indexedStatus = 'expired';
      } else if (sub.expiryUnix > nowSec && sub.status === SubscriptionStatus.ACTIVE) {
        indexedStatus = 'active';
      } else {
        indexedStatus = 'expired';
      }
      indexed = {
        subscriptionId: sub.id,
        planId: sub.planId,
        status: sub.status,
        expiresAt: new Date(sub.expiryUnix * 1000).toISOString(),
        expiresAtUnix: sub.expiryUnix,
        createdAt: sub.createdAt.toISOString(),
      };
    }

    const contractId = this.chainReader?.getConfiguredContractId();
    let chain: {
      configured: boolean;
      isSubscriber: boolean | null;
      error?: string;
      simulationCost?: {
        method: string;
        worstCaseMinResourceFee: string | null;
        lastObservedMinResourceFee: string | null;
        updatedAt: string | null;
        stale: boolean;
      };
    };

    if (!contractId || !this.chainReader) {
      chain = { configured: false, isSubscriber: null };
    } else {
      const result = await this.chainReader.readIsSubscriber(
        contractId,
        fan,
        creator,
      );
      const simulationCost = this.chainReader.getSimulationCostSummary(
        'is_subscriber',
      ) as {
        method: string;
        worstCaseMinResourceFee: string | null;
        lastObservedMinResourceFee: string | null;
        updatedAt: string | null;
        stale: boolean;
      };
      chain = result.ok
        ? {
            configured: true,
            isSubscriber: result.isSubscriber,
            simulationCost,
          }
        : {
            configured: true,
            isSubscriber: null,
            error: result.error,
            simulationCost,
          };
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

  async getFanDashboardSummary(
    fan: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const activeSubs = await this.indexRepo.listActiveForFan(fan, page, limit);
    const nowSecs = Date.now() / 1000;
    void nowSecs;

    activeSubs.sort((a, b) => a.expiryUnix - b.expiryUnix);

    const total = activeSubs.length; // Note: for full count, add count query
    const subscriptions = activeSubs.map((sub) => {
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
        renewsAt: new Date(sub.expiryUnix * 1000).toISOString(),
        renewsAtUnix: sub.expiryUnix,
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

  async listSubscriptions(
    fan: string,
    status?: SubscriptionStatus,
    sort?: string,
    cursor?: string,
    limit: number = 20,
  ) {
    const results = await this.indexRepo.findWithCursor(fan, status, sort, cursor, limit);    const hasMore = results.length > limit;
    if (hasMore) {
      results.pop();
    }

    const formatted = results.map((sub) => ({
      id: sub.id,
      creatorId: sub.creator,
      creatorName: this.creatorProfiles.get(sub.creator)?.name || 'Unknown Creator',
      creatorUsername: sub.creator.substring(0, 8),
      planName: 'Subscription', // from plan mock
      price: 0,
      currency: 'XLM',
      interval: 'month',
      currentPeriodEnd: new Date(sub.expiryUnix * 1000).toISOString(),
      status: sub.status,
      createdAt: sub.createdAt.toISOString(),
    }));

    let nextCursor: string | null = null;
    if (results.length > 0) {
      nextCursor = String(results[results.length - 1].id);
    }

    return new PaginatedResponseDto(formatted, limit, nextCursor, hasMore);
  }

  async listCreatorSubscribers(
    creator: string,
    status?: SubscriberListStatus,
    cursor?: string,
    limit: number = 20,
    sort?: string,
  ) {
    const nowSecs = Math.floor(Date.now() / 1000);
    let subscribers = (await this.indexRepo.listForCreator(creator))
      .map((sub) => {
        const derivedStatus = this.getDerivedSubscriberStatus(sub, nowSecs);
        return {
          id: sub.id,
          fanAddress: sub.fan,
          creatorAddress: sub.creator,
          planId: sub.planId,
          status: derivedStatus,
          expiresAt: new Date(sub.expiryUnix * 1000).toISOString(),
          createdAt: sub.createdAt.toISOString(),
        };
      });

    if (status) {
      subscribers = subscribers.filter((sub) => sub.status === status);
    }

    if (sort === 'expiry') {
      subscribers.sort(
        (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
      );
    } else {
      // default: sort by created desc
      subscribers.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }

    if (cursor) {
      subscribers = subscribers.filter((sub) => sub.id > cursor);
    }

    const paginatedResults = subscribers.slice(0, limit + 1);
    const hasMore = paginatedResults.length > limit;
    if (hasMore) {
      paginatedResults.pop();
    }

    let nextCursor: string | null = null;
    if (paginatedResults.length > 0) {
      nextCursor = String(paginatedResults[paginatedResults.length - 1].id);
    }

    return new PaginatedResponseDto(paginatedResults, limit, nextCursor, hasMore);
  }

  async getCreatorDashboardSummary(creatorAddress: string) {
    const allSubs = await this.indexRepo.listForCreator(creatorAddress);
    const nowSecs = Math.floor(Date.now() / 1000);

    const active = allSubs.filter(s => s.status === 'active' && s.expiryUnix > nowSecs);
    const totalSubscribers = active.length;

    let mrr = 0;
    for (const sub of active) {
      const plan = this.getPlanMock(sub.planId);
      if (plan) {
        const monthlyAmount = parseFloat(plan.amount) * (30 / plan.intervalDays);
        mrr += monthlyAmount;
      }
    }

    const activeSubscriptions = allSubs.filter(s => s.status === 'active').length;

    const recentActivity = allSubs
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map((sub) => ({
        id: sub.id,
        type: sub.eventType === 'cancelled' ? 'cancellation' : sub.eventType === 'extended' ? 'renewal' : 'subscription',
        title:
          sub.eventType === 'cancelled'
            ? 'Subscription cancelled'
            : sub.eventType === 'extended'
              ? 'Renewal'
              : 'New subscriber',
        description: `@${sub.fan.slice(0, 8)} ${
          sub.eventType === 'cancelled'
            ? 'cancelled'
            : sub.eventType === 'extended'
              ? 'renewed'
              : 'subscribed to'
        } your content`,
        timestamp: sub.createdAt.toISOString(),
      }));

    return {
      totalSubscribers,
      totalSubscribersChangePercent: 0,
      mrr: Math.round(mrr * 100) / 100,
      mrrChangePercent: 0,
      activeSubscriptions,
      activeSubscriptionsChangePercent: 0,
      recentActivity,
    };
  }

  async createCheckout(
    fanAddress: string,
    creatorAddress: string,
    planId: number,
    assetCode = 'XLM',
    assetIssuer?: string,
    requestNetwork?: string,
  ): Promise<Checkout> {
    this.assertNetworkMatch(requestNetwork);

    const plan = this.getPlanMock(planId);
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    // A fan can only subscribe to a creator that exists in the API-side
    // creator registry. On-chain-only creators (no CreatorProfile / registry
    // mapping) are rejected here with a clear error instead of producing a
    // checkout for a creator whose profile 404s (#1625).
    if (!this.creatorProfiles.has(creatorAddress)) {
      throw new NotFoundException(`Unknown API creator: ${creatorAddress}`);
    }

    const amount = plan.amount;
    const fee = this.calculateFee(amount);
    const total = (parseFloat(amount) + parseFloat(fee)).toFixed(7);

    // Spending cap is keyed on the fan's Stellar address (same key used by
    // /subscriptions/me/spending-cap), so this rejects checkouts that would
    // push the fan over their configured cap regardless of whether they
    // authenticated with a Stellar bearer token or a linked JWT.
    if (this.spendingCapService) {
      await this.spendingCapService.assertWithinCap(
        fanAddress,
        this.amountToStroops(total),
      );
    }

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

  async validateBalance(
    fanAddress: string,
    assetCode: string,
    requiredAmount: string,
  ): Promise<{ valid: boolean; balance: string; shortfall?: string }> {
    const balance = await this.rpcAdapter.getBalance(fanAddress, assetCode);
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

  async getWalletStatus(fanAddress: string) {
    const balances = await Promise.all(
      this.supportedAssets.map(async (asset) => ({
        code: asset.code,
        issuer: asset.issuer,
        balance: await this.rpcAdapter.getBalance(fanAddress, asset.code),
        isNative: asset.isNative,
      })),
    );
    return {
      address: fanAddress,
      balances,
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

  /**
   * Confirms a checkout only after independently verifying the supplied
   * txHash succeeded on-chain via Soroban RPC. This is the sole gate that
   * is allowed to move a subscription to ACTIVE from the checkout path —
   * client-side "trust me" confirmation is not sufficient (see #1574).
   *
   * State machine: pending -> confirmed_on_chain -> completed (indexed).
   * Idempotent: replaying the same txHash against an already-completed
   * checkout returns the original result without reprocessing.
   */
  async confirmSubscription(checkoutId: string, txHash: string) {
    if (!txHash || !txHash.trim()) {
      throw new BadRequestException(
        'txHash is required to confirm a subscription',
      );
    }

    const checkout = this.getCheckout(checkoutId);

    // Idempotent replay: same hash already fully processed for this checkout.
    if (checkout.status === CheckoutStatus.COMPLETED) {
      if (checkout.txHash !== txHash) {
        throw new BadRequestException(
          'Checkout has already been confirmed with a different transaction hash',
        );
      }
      const existingSubscription = await this.getSubscription(
        checkout.fanAddress,
        checkout.creatorAddress,
      );
      return {
        success: true,
        checkoutId: checkout.id,
        status: checkout.status,
        txHash: checkout.txHash,
        explorerUrl: `https://stellar.expert/explorer/testnet/tx/${checkout.txHash}`,
        subscriptionId: existingSubscription?.id ?? '',
        lifecycleEvent: 'renewed',
        message: 'Subscription already confirmed for this transaction.',
      };
    }

    if (
      checkout.status === CheckoutStatus.FAILED ||
      checkout.status === CheckoutStatus.REJECTED ||
      checkout.status === CheckoutStatus.EXPIRED
    ) {
      throw new BadRequestException(
        `Checkout cannot be confirmed from status "${checkout.status}"`,
      );
    }

    // Verify the transaction actually landed on-chain before trusting it.
    const verification = await this.verifyOnChainTransaction(txHash);
    if (!verification.ok) {
      throw new BadRequestException(
        `Unable to verify transaction on-chain: ${verification.error}`,
      );
    }

    checkout.status = CheckoutStatus.CONFIRMED_ON_CHAIN;
    checkout.txHash = txHash;
    checkout.updatedAt = new Date();

    const existingSubscription = await this.getSubscription(
      checkout.fanAddress,
      checkout.creatorAddress,
    );

    const resolvedSubscription = existingSubscription
      ? await this.renewSubscription(
          checkout.fanAddress,
          checkout.creatorAddress,
          checkout.planId,
          undefined,
          verification.ledger,
        )
      : await this.addSubscription(
          checkout.fanAddress,
          checkout.creatorAddress,
          checkout.planId,
          this.calculateExpiryTimestamp(
            this.getRequiredPlan(checkout.planId).intervalDays,
          ),
          verification.ledger,
        );

    // Chain evidence is now reflected in the subscription index.
    checkout.status = CheckoutStatus.COMPLETED;
    checkout.updatedAt = new Date();

    const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${checkout.txHash}`;

    // Record the spend against the fan's cap only once the on-chain
    // subscribe/renew is confirmed, mirroring the pre-checkout assertion in
    // createCheckout so a fan's usage always reflects settled spend.
    if (this.spendingCapService) {
      await this.spendingCapService.recordSpend(
        checkout.fanAddress,
        this.amountToStroops(checkout.total),
      );
    }

    return {
      success: true,
      checkoutId: checkout.id,
      status: checkout.status,
      txHash: checkout.txHash,
      explorerUrl,
      subscriptionId: resolvedSubscription.id,
      lifecycleEvent: existingSubscription ? 'renewed' : 'created',
      message: existingSubscription
        ? 'Subscription renewed successfully!'
        : 'Subscription created successfully!',
    };
  }

  /**
   * Looks up `txHash` via Soroban RPC and confirms it succeeded. Unknown,
   * pending, or failed hashes are rejected — the caller must not activate
   * a subscription on unverified chain evidence.
   */
  private async verifyOnChainTransaction(
    txHash: string,
  ): Promise<{ ok: true; ledger?: number } | { ok: false; error: string }> {
    if (!this.soroban) {
      return { ok: false, error: 'Transaction verification service unavailable' };
    }
    try {
      const result = await this.soroban.getTransaction(txHash);
      if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        return { ok: true, ledger: result.ledger };
      }
      return { ok: false, error: `transaction status: ${result.status}` };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'RPC lookup failed',
      };
    }
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

  /** Converts a decimal Stellar amount string (e.g. "10.5000000") to stroops (1 XLM = 10^7 stroops). */
  private amountToStroops(amount: string): bigint {
    const [whole, frac = ''] = amount.split('.');
    const fracPadded = (frac + '0000000').slice(0, 7);
    return BigInt(whole || '0') * BigInt(10000000) + BigInt(fracPadded || '0');
  }

  private getDerivedSubscriberStatus(
    sub: SubscriptionIndexEntity,
    nowSecs: number,
  ): SubscriberListStatus {
    if (
      sub.status === SubscriptionStatus.ACTIVE &&
      Number(sub.expiryUnix) > nowSecs
    ) {
      return 'active';
    }

    return 'expired';
  }

  private getIntervalText(days: number): string {
    if (days === 1) return 'Daily';
    if (days === 7) return 'Weekly';
    if (days === 30) return 'Monthly';
    if (days === 365) return 'Yearly';
    return `${days} days`;
  }

  private getPlanMock(planId: number): Plan | undefined {
    return this.getPlan(planId);
  }

  getAllSubscriptionsInternal(): Promise<SubscriptionIndexEntity[]> {
    return this.indexRepo.findAllForReconciler();
  }

  /** Returns completed checkouts for analytics aggregation. */
  getCompletedPayments(): Checkout[] {
    return Array.from(this.checkouts.values()).filter(
      (c) => c.status === CheckoutStatus.COMPLETED,
    );
  }

  private getPlan(planId: number): Plan | undefined {
    return this.plans.get(planId);
  }

  private getRequiredPlan(planId: number): Plan {
    const plan = this.getPlan(planId);
    if (!plan) {
      throw new NotFoundException(`Plan ${planId} not found`);
    }
    return plan;
  }

  private calculateExpiryTimestamp(intervalDays: number): number {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const intervalSeconds = intervalDays * 24 * 60 * 60;
    const expiry = nowSeconds + intervalSeconds;

    if (!Number.isSafeInteger(expiry)) {
      throw new BadRequestException('Expiry calculation would overflow');
    }

    return expiry;
  }

  private emitRenewalFailureEvent(checkout: Checkout, reason: string): void {
    this.emitSubscriptionLifecycleEvent(SUBSCRIPTION_RENEWAL_FAILED, {
      subscriptionId: checkout.id,
      reason,
      timestamp: new Date().toISOString(),
      userId: checkout.fanAddress,
    });
  }

  /** Fire-and-forget emit through the external SUBSCRIPTION_EVENT_PUBLISHER, if configured. */
  private emitSubscriptionLifecycleEvent(
    eventName: string,
    payload: SubscriptionEventPayload,
  ): void {
    Promise.resolve()
      .then(() => this.subscriptionEventPublisher?.emit(eventName, payload))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to emit ${eventName} event: ${message}`);
      });
  }
}
