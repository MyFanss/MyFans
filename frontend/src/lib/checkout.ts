/**
 * Checkout API Service
 * Handles all checkout-related API calls to the backend
 */

const API_BASE_URL = "http://localhost:3000";

export interface CreateCheckoutRequest {
  fanAddress: string;
  creatorAddress: string;
  planId: number;
  assetCode?: string;
  assetIssuer?: string;
}

export interface CheckoutResponse {
  id: string;
  fanAddress: string;
  creatorAddress: string;
  planId: number;
  assetCode: string;
  assetIssuer?: string;
  amount: string;
  fee: string;
  total: string;
  status: string;
  expiresAt: string;
  txHash?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanSummary {
  id: number;
  creatorName: string;
  creatorAddress: string;
  name: string;
  description?: string;
  assetCode: string;
  assetIssuer?: string;
  amount: string;
  interval: string;
  intervalDays: number;
}

export interface PriceBreakdown {
  subtotal: string;
  platformFee: string;
  networkFee: string;
  total: string;
  currency: string;
}

export interface AssetBalance {
  code: string;
  issuer?: string;
  balance: string;
  limit?: string;
  isNative: boolean;
}

export interface WalletStatus {
  address: string;
  balances: AssetBalance[];
  isConnected: boolean;
}

export interface TransactionPreview {
  checkoutId: string;
  from: string;
  to: string;
  asset: {
    code: string;
    issuer?: string;
  };
  amount: string;
  fee: string;
  total: string;
  memo?: string;
}

export interface CheckoutResult {
  success: boolean;
  checkoutId: string;
  status: string;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
  message?: string;
}

export interface BalanceValidation {
  valid: boolean;
  balance: string;
  shortfall?: string;
}

/**
 * Create a new checkout session
 */
export async function createCheckout(
  request: CreateCheckoutRequest
): Promise<CheckoutResponse> {
  const response = await fetch(`${API_BASE_URL}/subscriptions/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Failed to create checkout" }));
    throw new Error(error.message || "Failed to create checkout");
  }

  return response.json();
}

/**
 * Get checkout details
 */
export async function getCheckout(
  checkoutId: string
): Promise<CheckoutResponse> {
  const response = await fetch(
    `${API_BASE_URL}/subscriptions/checkout/${checkoutId}`
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Checkout not found" }));
    throw new Error(error.message || "Failed to get checkout");
  }

  return response.json();
}

/**
 * Get plan summary for a checkout
 */
export async function getPlanSummary(checkoutId: string): Promise<PlanSummary> {
  const response = await fetch(
    `${API_BASE_URL}/subscriptions/checkout/${checkoutId}/plan`
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Plan not found" }));
    throw new Error(error.message || "Failed to get plan summary");
  }

  return response.json();
}

/**
 * Get price breakdown for a checkout
 */
export async function getPriceBreakdown(
  checkoutId: string
): Promise<PriceBreakdown> {
  const response = await fetch(
    `${API_BASE_URL}/subscriptions/checkout/${checkoutId}/price`
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Price breakdown not found" }));
    throw new Error(error.message || "Failed to get price breakdown");
  }

  return response.json();
}

/**
 * Get wallet status with balances
 */
export async function getWalletStatus(
  checkoutId: string
): Promise<WalletStatus> {
  const response = await fetch(
    `${API_BASE_URL}/subscriptions/checkout/${checkoutId}/wallet`
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Wallet status not found" }));
    throw new Error(error.message || "Failed to get wallet status");
  }

  return response.json();
}

/**
 * Get transaction preview
 */
export async function getTransactionPreview(
  checkoutId: string
): Promise<TransactionPreview> {
  const response = await fetch(
    `${API_BASE_URL}/subscriptions/checkout/${checkoutId}/preview`
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Preview not found" }));
    throw new Error(error.message || "Failed to get transaction preview");
  }

  return response.json();
}

/**
 * Validate user balance
 */
export async function validateBalance(
  checkoutId: string,
  assetCode: string,
  amount: string
): Promise<BalanceValidation> {
  const response = await fetch(
    `${API_BASE_URL}/subscriptions/checkout/${checkoutId}/validate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ assetCode, amount }),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Validation failed" }));
    throw new Error(error.message || "Failed to validate balance");
  }

  return response.json();
}

/**
 * Confirm subscription (success callback)
 */
export async function confirmSubscription(
  checkoutId: string,
  txHash?: string
): Promise<CheckoutResult> {
  const response = await fetch(
    `${API_BASE_URL}/subscriptions/checkout/${checkoutId}/confirm`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ checkoutId, txHash }),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Confirmation failed" }));
    throw new Error(error.message || "Failed to confirm subscription");
  }

  return response.json();
}

/**
 * Handle checkout failure
 */
export async function failCheckout(
  checkoutId: string,
  error: string,
  rejected: boolean = false
): Promise<CheckoutResult> {
  const response = await fetch(
    `${API_BASE_URL}/subscriptions/checkout/${checkoutId}/fail`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error, rejected }),
    }
  );

  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ message: "Failed to record failure" }));
    throw new Error(err.message || "Failed to record checkout failure");
  }

  return response.json();
}

/**
 * Get full checkout data (all endpoints in one call)
 */
export async function getFullCheckoutData(checkoutId: string) {
  const [checkout, planSummary, priceBreakdown, walletStatus, preview] =
    await Promise.all([
      getCheckout(checkoutId),
      getPlanSummary(checkoutId),
      getPriceBreakdown(checkoutId),
      getWalletStatus(checkoutId),
      getTransactionPreview(checkoutId),
    ]);

  return {
    checkout,
    planSummary,
    priceBreakdown,
    walletStatus,
    preview,
  };
}
