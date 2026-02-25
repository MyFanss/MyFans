import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PaginatedResponseDto } from '../common/dto';

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

/** Generate a simple UUID */
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

  // Mock platform fee (in basis points, e.g., 500 = 5%)
  private platformFeeBps = 500;

  // Mock supported assets
  private supportedAssets: { code: string; issuer?: string; isNative: boolean }[] = [
    { code: 'XLM', isNative: true },
    { code: 'USDC', issuer: 'GA7Z6G7T3LSSKDAWJH25C4JPLD4PQV4CEMM5S5E6LQD3VDF5W6G6F3K', isNative: false },
  ];

  // Mock creator profiles
  private creatorProfiles: Map<string, { name: string; description?: string }> = new Map();

  constructor() {
    // Set up mock creator profiles
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
      createdAt: new Date()
    });
  }

  isSubscriber(fan: string, creator: string): boolean {
    const sub = this.subscriptions.get(this.getKey(fan, creator));
    return sub ? sub.expiry > Date.now() / 1000 : false;
  }

  getSubscription(fan: string, creator: string): Subscription | undefined {
    return this.subscriptions.get(this.getKey(fan, creator));
  }

  listSubscriptions(fan: string, status?: string, sort?: string, page: number = 1, limit: number = 20) {
    // Convert map values to array for the given fan
    let userSubs = Array.from(this.subscriptions.values()).filter(sub => sub.fan === fan);

    // Update statuses dynamically before returning just in case expiry has passed silently
    const nowSecs = Date.now() / 1000;
    userSubs.forEach(sub => {
      if (sub.status === 'active' && sub.expiry <= nowSecs) {
        sub.status = 'expired';
      }
    });

    // Apply status filter
    if (status) {
      userSubs = userSubs.filter(sub => sub.status === status);
    }

    // Map to include creator info and formatted details
    let results = userSubs.map(sub => {
      const plan = this.getPlanMock(sub.planId);
      const creatorProfile = this.creatorProfiles.get(sub.creator);

      return {
        id: sub.id,
        creatorId: sub.creator,
        creatorName: creatorProfile?.name || 'Unknown Creator',
        creatorUsername: sub.creator.substring(0, 8), // Mock username
        planName: plan ? `${this.getIntervalText(plan.intervalDays)} Subscription` : 'Subscription',
        price: plan ? parseFloat(plan.amount) : 0,
        currency: plan ? plan.asset.split(':')[0] : 'XLM',
        interval: plan && plan.intervalDays === 30 ? 'month' : plan && plan.intervalDays === 365 ? 'year' : 'month',
        currentPeriodEnd: new Date(sub.expiry * 1000).toISOString(),
        status: sub.status,
        createdAt: sub.createdAt.toISOString(),
      };
    });

    // Apply sorting
    if (sort === 'created') { // default to desc for created
      results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else { // default to expiry asc
      results.sort((a, b) => new Date(a.currentPeriodEnd).getTime() - new Date(b.currentPeriodEnd).getTime());
    }

    // Apply pagination
    const total = results.length;
    const skip = (page - 1) * limit;
    const paginatedResults = results.slice(skip, skip + limit);

    return new PaginatedResponseDto(paginatedResults, total, page, limit);
  }

  // ==================== Checkout Methods ====================

  /**
   * Create a new checkout session
   */
  createCheckout(
    fanAddress: string,
    creatorAddress: string,
    planId: number,
    assetCode: string = 'XLM',
    assetIssuer?: string,
  ): Checkout {
    // Validate plan exists (mock validation)
    const plan = this.getPlanMock(planId);
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    // Calculate fees
    const amount = plan.amount;
    const fee = this.calculateFee(amount);
    const total = (parseFloat(amount) + parseFloat(fee)).toFixed(7);

    // Create checkout
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

  /**
   * Get checkout by ID
   */
  getCheckout(checkoutId: string): Checkout {
    const checkout = this.checkouts.get(checkoutId);
    if (!checkout) {
      throw new NotFoundException('Checkout not found');
    }

    // Check if expired
    if (new Date() > checkout.expiresAt) {
      checkout.status = CheckoutStatus.EXPIRED;
      throw new BadRequestException('Checkout session has expired');
    }

    return checkout;
  }

  /**
   * Get plan summary
   */
  getPlanSummary(planId: number) {
    const plan = this.getPlanMock(planId);
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    const creatorProfile = this.creatorProfiles.get(plan.creator);
    const intervalText = this.getIntervalText(plan.intervalDays);

    // Parse asset code and issuer from the asset string
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

  /**
   * Get price breakdown
   */
  getPriceBreakdown(checkoutId: string) {
    const checkout = this.getCheckout(checkoutId);

    return {
      subtotal: checkout.amount,
      platformFee: checkout.fee,
      networkFee: '0.00001', // Mock network fee
      total: checkout.total,
      currency: checkout.assetCode,
    };
  }

  /**
   * Validate user balance
   */
  validateBalance(fanAddress: string, assetCode: string, requiredAmount: string): { valid: boolean; balance: string; shortfall?: string } {
    // Mock balance check - in real app, query Stellar blockchain
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

  /**
   * Get wallet status with balances
   */
  getWalletStatus(fanAddress: string) {
    const balances = this.supportedAssets.map(asset => ({
      code: asset.code,
      issuer: asset.issuer,
      balance: this.getMockBalance(fanAddress, asset.code),
      isNative: asset.isNative,
    }));

    return {
      address: fanAddress,
      balances,
      isConnected: !!fanAddress,
    };
  }

  /**
   * Get transaction preview
   */
  getTransactionPreview(checkoutId: string) {
    const checkout = this.getCheckout(checkoutId);
    const plan = this.getPlanMock(checkout.planId);
    const creatorProfile = this.creatorProfiles.get(checkout.creatorAddress);

    return {
      checkoutId: checkout.id,
      from: checkout.fanAddress,
      to: checkout.creatorAddress,
      asset: {
        code: checkout.assetCode,
        issuer: checkout.assetIssuer,
      },
      amount: checkout.amount,
      fee: checkout.fee,
      total: checkout.total,
      memo: `Subscribe to ${creatorProfile?.name || 'creator'}`,
    };
  }

  /**
   * Confirm subscription (success callback)
   */
  confirmSubscription(checkoutId: string, txHash?: string) {
    const checkout = this.getCheckout(checkoutId);

    // Update checkout status
    checkout.status = CheckoutStatus.COMPLETED;
    checkout.txHash = txHash || `tx_${Date.now()}`;
    checkout.updatedAt = new Date();

    // Generate explorer URL
    const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${checkout.txHash}`;

    // Create subscription
    this.addSubscription(checkout.fanAddress, checkout.creatorAddress, checkout.planId,
      Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60); // 30 days

    return {
      success: true,
      checkoutId: checkout.id,
      status: checkout.status,
      txHash: checkout.txHash,
      explorerUrl,
      message: 'Subscription created successfully!',
    };
  }

  /**
   * Handle checkout failure/rejection
   */
  failCheckout(checkoutId: string, error: string, isRejected: boolean = false) {
    const checkout = this.getCheckout(checkoutId);

    checkout.status = isRejected ? CheckoutStatus.REJECTED : CheckoutStatus.FAILED;
    checkout.error = error;
    checkout.updatedAt = new Date();

    return {
      success: false,
      checkoutId: checkout.id,
      status: checkout.status,
      error: error,
      message: isRejected ? 'Transaction was rejected' : 'Transaction failed',
    };
  }

  // ==================== Helper Methods ====================

  private calculateFee(amount: string): string {
    const amountNum = parseFloat(amount);
    const feeNum = (amountNum * this.platformFeeBps) / 10000;
    return feeNum.toFixed(7);
  }

  private getIntervalText(days: number): string {
    if (days === 1) return 'Daily';
    if (days === 7) return 'Weekly';
    if (days === 30) return 'Monthly';
    if (days === 365) return 'Yearly';
    return `${days} days`;
  }

  private getMockBalance(address: string, assetCode: string): string {
    // Mock different balances based on address for testing
    // In real app, query Stellar blockchain
    if (assetCode === 'XLM') {
      return '1000.0000000'; // Mock XLM balance
    }
    if (assetCode === 'USDC') {
      return '50.0000000'; // Mock USDC balance
    }
    return '0.0000000';
  }

  private getPlanMock(planId: number): Plan | undefined {
    // Mock plans - in real app, fetch from database
    const plans: Plan[] = [
      { id: 1, creator: 'GAAAAAAAAAAAAAAA', asset: 'XLM', amount: '10', intervalDays: 30 },
      { id: 2, creator: 'GAAAAAAAAAAAAAAA', asset: 'USDC:GA7Z6G7T3LSSKDJPLAWJH25C4D4PQV4CEMM5S5E6LQD3VDF5W6G6F3K', amount: '5', intervalDays: 30 },
      { id: 3, creator: 'GBBD47ZY6F6R7OGMW5G6C5R5P6NQ5QW5R5V5S5R5O5P5Q5R5V5S5R5O5', asset: 'XLM', amount: '25', intervalDays: 7 },
    ];
    return plans.find(p => p.id === planId);
  }
}

