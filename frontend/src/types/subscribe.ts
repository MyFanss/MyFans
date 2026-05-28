import type { AppError } from './errors';

export interface SubscriptionPlan {
  id: number;
  name: string;
  price: string;
  currency: string;
  billingInterval: 'monthly' | 'yearly' | 'one-time';
  creatorName: string;
  creatorAddress: string;
}

export type TxPollStatus = 'pending' | 'confirmed' | 'failed' | 'timeout';

export interface TransactionPollResult {
  status: TxPollStatus;
  txHash: string;
  elapsedMs: number;
}

export type FlowState =
  | { step: 'wallet-gate' }
  | { step: 'confirmation'; plan: SubscriptionPlan; walletAddress: string }
  | { step: 'awaiting-signature'; plan: SubscriptionPlan; walletAddress: string }
  | { step: 'submitting'; plan: SubscriptionPlan; signedXdr: string }
  | { step: 'polling'; plan: SubscriptionPlan; txHash: string }
  | { step: 'success'; plan: SubscriptionPlan; txHash: string }
  | { step: 'error'; plan: SubscriptionPlan | null; error: AppError; retryCount: number };
