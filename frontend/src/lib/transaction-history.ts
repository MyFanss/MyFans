'use client';

export type TrackedTransactionStatus = 'pending' | 'confirmed' | 'failed';
export type TrackedTransactionType = 'subscription' | 'tip' | 'withdrawal' | 'purchase';

export interface TrackedTransaction {
  id: string;
  checkoutId: string;
  txHash: string;
  status: TrackedTransactionStatus;
  type: TrackedTransactionType;
  description: string;
  amount: string;
  currency: string;
  creatorName?: string;
  planName?: string;
  explorerUrl: string;
  createdAt: string;
  updatedAt: string;
  simulatedCompletionAt?: string;
}

interface CreateTrackedTransactionInput {
  checkoutId: string;
  txHash: string;
  type: TrackedTransactionType;
  description: string;
  amount: string;
  currency: string;
  creatorName?: string;
  planName?: string;
  status?: TrackedTransactionStatus;
}

const STORAGE_KEY = 'myfans.transactions';
const DEFAULT_EXPLORER_BASE = 'https://stellar.expert/explorer/public/tx/';
const POLLING_COMPLETE_AFTER_MS = 12000;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getExplorerUrl(txHash: string) {
  return `${DEFAULT_EXPLORER_BASE}${txHash}`;
}

function readTransactions(): TrackedTransaction[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as TrackedTransaction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTransactions(transactions: TrackedTransaction[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

export function getTrackedTransactions() {
  return readTransactions().sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
}

export function getTrackedTransactionByCheckoutId(checkoutId?: string | null) {
  if (!checkoutId) {
    return null;
  }

  return getTrackedTransactions().find((transaction) => transaction.checkoutId === checkoutId) ?? null;
}

export function getLatestTrackedTransaction() {
  return getTrackedTransactions()[0] ?? null;
}

export function createTrackedTransaction(input: CreateTrackedTransactionInput) {
  const now = new Date().toISOString();
  const transactions = readTransactions();
  const transaction: TrackedTransaction = {
    id: `${input.checkoutId}:${input.txHash}`,
    checkoutId: input.checkoutId,
    txHash: input.txHash,
    status: input.status ?? 'pending',
    type: input.type,
    description: input.description,
    amount: input.amount,
    currency: input.currency,
    creatorName: input.creatorName,
    planName: input.planName,
    explorerUrl: getExplorerUrl(input.txHash),
    createdAt: now,
    updatedAt: now,
    simulatedCompletionAt:
      input.status === 'failed' ? undefined : new Date(Date.now() + POLLING_COMPLETE_AFTER_MS).toISOString(),
  };

  const deduped = transactions.filter((item) => item.checkoutId !== input.checkoutId);
  writeTransactions([transaction, ...deduped]);
  return transaction;
}

export function pollTrackedTransaction(checkoutId?: string | null) {
  if (!checkoutId) {
    return null;
  }

  const transactions = readTransactions();
  const index = transactions.findIndex((item) => item.checkoutId === checkoutId);
  if (index === -1) {
    return null;
  }

  const current = transactions[index];
  if (
    current.status === 'pending' &&
    current.simulatedCompletionAt &&
    Date.now() >= new Date(current.simulatedCompletionAt).getTime()
  ) {
    const updated: TrackedTransaction = {
      ...current,
      status: 'confirmed',
      updatedAt: new Date().toISOString(),
    };

    const nextTransactions = [...transactions];
    nextTransactions[index] = updated;
    writeTransactions(nextTransactions);
    return updated;
  }

  return current;
}

export function copyToClipboard(value: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    throw new Error('Clipboard is not available');
  }

  return navigator.clipboard.writeText(value);
}

export async function shareTransaction(transaction: TrackedTransaction) {
  const shareUrl = transaction.explorerUrl;
  const text = `${transaction.description} • ${transaction.amount} ${transaction.currency}`;

  if (typeof navigator !== 'undefined' && navigator.share) {
    await navigator.share({
      title: 'MyFans transaction',
      text,
      url: shareUrl,
    });
    return 'shared';
  }

  await copyToClipboard(shareUrl);
  return 'copied';
}
