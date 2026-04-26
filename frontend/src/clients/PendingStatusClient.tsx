'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BaseCard } from '@/components/cards';
import Button from '@/components/Button';
import { PendingStatus, type PendingState } from '@/components/pending';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import {
  copyToClipboard,
  getLatestTrackedTransaction,
  getTrackedTransactionByCheckoutId,
  getTrackedTransactions,
  pollTrackedTransaction,
  shareTransaction,
  type TrackedTransaction,
  type TrackedTransactionStatus,
} from '@/lib/transaction-history';

type HistoryFilter = 'all' | TrackedTransactionStatus;
type TypeFilter = 'all' | TrackedTransaction['type'];

const STATUS_LABELS: Record<TrackedTransactionStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  failed: 'Failed',
};

const STATUS_BADGES: Record<TrackedTransactionStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
};

function getCheckoutIdFromLocation() {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  return params.get('checkoutId');
}

function getInitialCurrentTransaction(checkoutId: string | null) {
  const latestTransaction = getLatestTrackedTransaction();
  if (checkoutId) {
    return pollTrackedTransaction(checkoutId) ?? getTrackedTransactionByCheckoutId(checkoutId);
  }

  if (!latestTransaction) {
    return null;
  }

  return pollTrackedTransaction(latestTransaction.checkoutId) ?? latestTransaction;
}

function getInitialTransactions() {
  return getTrackedTransactions().map(
    (transaction) => pollTrackedTransaction(transaction.checkoutId) ?? transaction
  );
}

function mapStatusToPendingState(status: TrackedTransactionStatus): PendingState {
  if (status === 'confirmed') {
    return 'success';
  }

  if (status === 'failed') {
    return 'error';
  }

  return 'pending';
}

function formatRelativeCountdown(simulatedCompletionAt?: string) {
  if (!simulatedCompletionAt) {
    return undefined;
  }

  const remaining = Math.max(
    0,
    Math.ceil((new Date(simulatedCompletionAt).getTime() - Date.now()) / 1000)
  );

  return remaining > 0 ? remaining : undefined;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function truncateHash(value: string) {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

export function PendingStatusClient() {
  const [checkoutId] = useState<string | null>(getCheckoutIdFromLocation);
  const [currentTransaction, setCurrentTransaction] = useState<TrackedTransaction | null>(() =>
    getInitialCurrentTransaction(getCheckoutIdFromLocation())
  );
  const [transactions, setTransactions] = useState<TrackedTransaction[]>(getInitialTransactions);
  const [statusFilter, setStatusFilter] = useState<HistoryFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [feedback, setFeedback] = useState<string | null>(null);

  const refreshTransactions = useCallback(() => {
    const latestTransaction = getLatestTrackedTransaction();
    const nextCurrent = checkoutId
      ? pollTrackedTransaction(checkoutId) ?? getTrackedTransactionByCheckoutId(checkoutId)
      : latestTransaction
      ? pollTrackedTransaction(latestTransaction.checkoutId) ?? latestTransaction
      : null;

    setCurrentTransaction(nextCurrent);
    setTransactions(getTrackedTransactions().map((transaction) => pollTrackedTransaction(transaction.checkoutId) ?? transaction));
  }, [checkoutId]);

  useEffect(() => {
    const intervalId = window.setInterval(refreshTransactions, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshTransactions]);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setFeedback(null), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((transaction) => {
        if (statusFilter !== 'all' && transaction.status !== statusFilter) {
          return false;
        }

        if (typeFilter !== 'all' && transaction.type !== typeFilter) {
          return false;
        }

        return true;
      }),
    [transactions, statusFilter, typeFilter]
  );

  const handleCopy = useCallback(async (value: string, label: string) => {
    try {
      await copyToClipboard(value);
      setFeedback(`${label} copied.`);
    } catch {
      setFeedback(`Could not copy ${label.toLowerCase()}.`);
    }
  }, []);

  const handleShare = useCallback(async (transaction: TrackedTransaction) => {
    try {
      const result = await shareTransaction(transaction);
      setFeedback(result === 'shared' ? 'Transaction shared.' : 'Explorer link copied.');
    } catch {
      setFeedback('Share is not available on this device.');
    }
  }, []);

  if (!currentTransaction) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10 dark:bg-gray-950">
        <div className="mx-auto max-w-4xl">
          <BaseCard padding="lg" className="text-center">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Transaction status</h1>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              No tracked transactions yet. Complete a checkout to see live status and history here.
            </p>
          </BaseCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-gray-950">
      <div className="mx-auto max-w-5xl space-y-6">
        <section>
          <PendingStatus
            state={mapStatusToPendingState(currentTransaction.status)}
            transactionHash={currentTransaction.txHash}
            explorerUrl={currentTransaction.explorerUrl}
            message={currentTransaction.description}
            countdown={formatRelativeCountdown(currentTransaction.simulatedCompletionAt)}
            onContinue={
              currentTransaction.status === 'confirmed'
                ? () => {
                    window.location.href = '/subscriptions';
                  }
                : undefined
            }
            onRetry={
              currentTransaction.status === 'failed'
                ? () => {
                    window.location.href = '/subscribe';
                  }
                : undefined
            }
          />
        </section>

        <BaseCard padding="lg" as="section">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Current transaction</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Polling every 3 seconds for the latest status.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => handleCopy(currentTransaction.txHash, 'Transaction hash')}>
                Copy hash
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleCopy(currentTransaction.explorerUrl, 'Explorer link')}>
                Copy link
              </Button>
              <Button size="sm" variant="tertiary" onClick={() => handleShare(currentTransaction)}>
                Share
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoItem label="Checkout ID" value={currentTransaction.checkoutId} mono />
            <InfoItem label="Amount" value={`${currentTransaction.amount} ${currentTransaction.currency}`} />
            <InfoItem label="Updated" value={formatDate(currentTransaction.updatedAt)} />
            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Status</p>
              <div className="mt-2">
                <StatusIndicator
                  status={
                    currentTransaction.status === 'confirmed'
                      ? 'success'
                      : currentTransaction.status === 'failed'
                      ? 'error'
                      : 'pending'
                  }
                  label={STATUS_LABELS[currentTransaction.status]}
                />
              </div>
            </div>
          </div>

          {feedback ? <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-400">{feedback}</p> : null}
        </BaseCard>

        <BaseCard padding="lg" as="section">
          <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 dark:border-gray-700 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Transaction history</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Filter by status or transaction type, then copy or share any explorer link.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="text-sm text-gray-600 dark:text-gray-300">
                <span className="mb-1 block">Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as HistoryFilter)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="failed">Failed</option>
                </select>
              </label>

              <label className="text-sm text-gray-600 dark:text-gray-300">
                <span className="mb-1 block">Type</span>
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                >
                  <option value="all">All types</option>
                  <option value="subscription">Subscription</option>
                  <option value="purchase">Purchase</option>
                  <option value="tip">Tip</option>
                  <option value="withdrawal">Withdrawal</option>
                </select>
              </label>
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <p className="pt-6 text-sm text-gray-500 dark:text-gray-400">No transactions match these filters.</p>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTransactions.map((transaction) => (
                <article key={transaction.id} className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-medium text-gray-900 dark:text-white">{transaction.description}</p>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGES[transaction.status]}`}>
                        {STATUS_LABELS[transaction.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {transaction.amount} {transaction.currency} • {transaction.type} • {formatDate(transaction.createdAt)}
                    </p>
                    <a
                      href={transaction.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex text-sm text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {truncateHash(transaction.txHash)}
                    </a>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => handleCopy(transaction.txHash, 'Transaction hash')}>
                      Copy hash
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleCopy(transaction.explorerUrl, 'Explorer link')}>
                      Copy link
                    </Button>
                    <Button size="sm" variant="tertiary" onClick={() => handleShare(transaction)}>
                      Share
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </BaseCard>
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
      <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-2 break-all text-sm text-gray-900 dark:text-white ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
