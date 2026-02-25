'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  MOCK_ACTIVE,
  MOCK_HISTORY,
  MOCK_PAYMENTS,
  getCurrencySymbol,
  formatDate,
  type ActiveSubscription,
  type SubscriptionHistoryItem,
  type PaymentRecord,
} from '@/lib/subscriptions';
import { BaseCard } from '@/components/cards/BaseCard';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function SubscriptionsPage() {
  const [activeList, setActiveList] = useState<ActiveSubscription[]>([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [sortOption, setSortOption] = useState('expiry');
  const [cancelTarget, setCancelTarget] = useState<ActiveSubscription | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    let mounted = true;
    const fetchSubscriptions = async () => {
      setIsLoading(true);
      try {
        // Hardcode a fan address for demo purposes, since auth context isn't visible here
        const fanAddress = 'fan_demo_address';
        const res = await fetch(`http://localhost:3001/subscriptions/list?fan=${fanAddress}&status=${statusFilter}&sort=${sortOption}`);
        if (!res.ok) throw new Error('Failed to fetch subscriptions');
        const data = await res.json();
        if (mounted) {
          setActiveList(data);
        }
      } catch (err) {
        console.error(err);
        // Fallback or show error
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    fetchSubscriptions();
    return () => { mounted = false; };
  }, [statusFilter, sortOption]);

  const handleCancelConfirm = useCallback(async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      // Replace with API: await cancelSubscription(cancelTarget.id);
      setActiveList((prev: ActiveSubscription[]) => prev.filter((s: ActiveSubscription) => s.id !== cancelTarget.id));
      setCancelTarget(null);
    } finally {
      setIsCancelling(false);
    }
  }, [cancelTarget]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href="/" className="text-sm text-primary-600 dark:text-primary-400 hover:underline mb-2 inline-block">
            ← Back to MyFans
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My subscriptions</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your active subscriptions and view history.</p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={statusFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select
                value={sortOption}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortOption(e.target.value)}
                className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="expiry">Sort by Expiry</option>
                <option value="created">Sort by Created</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-10">
        {/* Active subscriptions */}
        <section aria-labelledby="active-heading">
          <h2 id="active-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Active subscriptions
          </h2>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading subscriptions...</div>
          ) : activeList.length === 0 ? (
            <EmptyState
              title="No subscriptions found"
              description="No subscriptions match your current filters."
              actionLabel="Discover creators"
              actionHref="/"
            />
          ) : (
            <ul className="space-y-3">
              {activeList.map((sub: ActiveSubscription) => (
                <li key={sub.id}>
                  <BaseCard padding="md" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        <Link href={`/creator/${sub.creatorUsername}`} className="hover:underline">
                          {sub.creatorName}
                        </Link>
                        <span className="text-gray-500 dark:text-gray-400 font-normal"> · {sub.planName}</span>
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {getCurrencySymbol(sub.currency)}{sub.price.toFixed(2)}/{sub.interval} · Renews {formatDate(sub.currentPeriodEnd)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCancelTarget(sub)}
                      className="flex-shrink-0 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      Cancel subscription
                    </button>
                  </BaseCard>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Subscription history */}
        <section aria-labelledby="history-heading">
          <h2 id="history-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Subscription history
          </h2>
          {MOCK_HISTORY.length === 0 ? (
            <EmptyState
              title="No subscription history"
              description="Cancelled subscriptions will appear here."
            />
          ) : (
            <ul className="space-y-3">
              {MOCK_HISTORY.map((item) => (
                <HistoryCard key={item.id} item={item} />
              ))}
            </ul>
          )}
        </section>

        {/* Payment history */}
        <section aria-labelledby="payments-heading">
          <h2 id="payments-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Payment history
          </h2>
          {MOCK_PAYMENTS.length === 0 ? (
            <EmptyState
              title="No payments yet"
              description="Payment records will appear here when you subscribe to creators."
            />
          ) : (
            <ul className="space-y-3">
              {MOCK_PAYMENTS.map((payment) => (
                <PaymentCard key={payment.id} payment={payment} />
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* Cancel confirmation modal */}
      {cancelTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-dialog-title"
        >
          <BaseCard padding="lg" className="max-w-md w-full">
            <h3 id="cancel-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Cancel subscription?
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              You will lose access to {cancelTarget.creatorName}&apos;s {cancelTarget.planName} content at the end of your current billing period ({formatDate(cancelTarget.currentPeriodEnd)}). You can resubscribe anytime.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={isCancelling}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Keep subscription
              </button>
              <button
                type="button"
                onClick={handleCancelConfirm}
                disabled={isCancelling}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling…' : 'Cancel subscription'}
              </button>
            </div>
          </BaseCard>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <BaseCard padding="lg" className="text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 mb-4" aria-hidden>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0V6a2 2 0 00-2-2H6a2 2 0 00-2 2v5" />
        </svg>
      </div>
      <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">{description}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-4 inline-block px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {actionLabel}
        </Link>
      )}
    </BaseCard>
  );
}

function HistoryCard({ item }: { item: SubscriptionHistoryItem }) {
  return (
    <BaseCard padding="md">
      <p className="font-medium text-gray-900 dark:text-white">
        {item.creatorName} · {item.planName}
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
        {getCurrencySymbol(item.currency)}{item.price.toFixed(2)} · {formatDate(item.startedAt)} – {formatDate(item.endedAt)}
      </p>
      {item.cancelReason && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{item.cancelReason}</p>
      )}
    </BaseCard>
  );
}

function PaymentCard({ payment }: { payment: PaymentRecord }) {
  const statusColor =
    payment.status === 'completed'
      ? 'text-green-600 dark:text-green-400'
      : payment.status === 'failed' || payment.status === 'refunded'
        ? 'text-red-600 dark:text-red-400'
        : 'text-gray-600 dark:text-gray-400';
  return (
    <BaseCard padding="md" className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div>
        <p className="font-medium text-gray-900 dark:text-white">
          {payment.creatorName} · {payment.planName}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(payment.date)}</p>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <span className="font-medium text-gray-900 dark:text-white">
          {getCurrencySymbol(payment.currency)}{payment.amount.toFixed(2)}
        </span>
        <span className={`text-sm capitalize ${statusColor}`}>{payment.status}</span>
      </div>
    </BaseCard>
  );
}
