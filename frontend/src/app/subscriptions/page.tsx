'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  type ActiveSubscription,
  type SubscriptionHistoryItem,
  type PaymentRecord,
} from '@/lib/subscriptions';
import {
  fetchActiveSubscriptions,
  fetchPaymentHistory,
  fetchSubscriptionHistory,
  SubscriptionsUnauthorizedError,
} from '@/lib/api/subscriptions';
import { formatCurrency, formatDate, getCurrencySymbol } from '@/lib/formatting';
import { BaseCard } from '@/components/cards/BaseCard';
import { Modal } from '@/components/Modal';
import HistoryCardSkeleton from '@/components/ui/HistoryCardSkeleton';
import ActiveSubscriptionSkeleton from '@/components/ui/ActiveSubscriptionSkeleton';
import { useToast } from '@/contexts/ToastContext';
import { subscriptionActionToast, subscriptionsLoadFailed } from '@/lib/error-copy';
import { cancelSubscriptionOnSoroban, extendSubscriptionOnSoroban, getStellarConfig } from '@/lib/stellar';
import NetworkMismatchBanner from '@/components/NetworkMismatchBanner';

export default function SubscriptionsPage() {
  const { showInfo, showSuccess, showError, showLoading, dismiss } = useToast();
  const [activeList, setActiveList] = useState<ActiveSubscription[]>([]);
  const [historyList, setHistoryList] = useState<SubscriptionHistoryItem[]>([]);
  const [paymentsList, setPaymentsList] = useState<PaymentRecord[]>([]);

  const [statusFilter, setStatusFilter] = useState('active');
  const [sortOption, setSortOption] = useState('expiry');
  const [cancelTarget, setCancelTarget] = useState<ActiveSubscription | null>(null);
  const [renewTarget, setRenewTarget] = useState<ActiveSubscription | SubscriptionHistoryItem | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isPaymentsLoading, setIsPaymentsLoading] = useState(true);
  const [activeListError, setActiveListError] = useState<'unauthorized' | 'error' | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchSubscriptions = async () => {
      setIsLoading(true);
      try {
        const list = await fetchActiveSubscriptions({ status: statusFilter, sort: sortOption });
        if (mounted) {
          setActiveList(list);
          setActiveListError(null);
        }
      } catch (err) {
        console.error(err);
        if (mounted) {
          setActiveList([]);
          setActiveListError(err instanceof SubscriptionsUnauthorizedError ? 'unauthorized' : 'error');
        }
        showError(
          'NETWORK_ERROR',
          err instanceof SubscriptionsUnauthorizedError
            ? { message: 'Please sign in again', description: err.message }
            : subscriptionsLoadFailed(),
        );
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    fetchSubscriptions();
    return () => { mounted = false; };
  }, [sortOption, statusFilter, showError]);

  useEffect(() => {
    let mounted = true;
    const loadHistory = async () => {
      setIsHistoryLoading(true);
      try {
        const items = await fetchSubscriptionHistory();
        if (mounted) setHistoryList(items);
      } catch (err) {
        console.error(err);
        showError('NETWORK_ERROR', {
          message: 'Couldn’t load subscription history',
          description:
            err instanceof SubscriptionsUnauthorizedError
              ? 'Your session has expired. Sign in again to see your subscription history.'
              : 'Refresh the page. If it still fails, check your internet and that the app backend is running.',
        });
      } finally {
        if (mounted) setIsHistoryLoading(false);
      }
    };
    loadHistory();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadPayments = async () => {
      setIsPaymentsLoading(true);
      try {
        const items = await fetchPaymentHistory();
        if (mounted) setPaymentsList(items);
      } catch (err) {
        console.error(err);
        showError('NETWORK_ERROR', {
          message: 'Couldn’t load payment history',
          description:
            err instanceof SubscriptionsUnauthorizedError
              ? 'Your session has expired. Sign in again to see your payment history.'
              : 'Refresh the page. If it still fails, check your internet and that the app backend is running.',
        });
      } finally {
        if (mounted) setIsPaymentsLoading(false);
      }
    };
    loadPayments();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleCancelConfirm = useCallback(async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    const loadingToastId = showLoading(`Cancelling ${cancelTarget.creatorName}...`);
    try {
      // Derive fan address from connected wallet; fall back to demo address
      const freighter = typeof window !== 'undefined'
        ? (window as unknown as { freighter?: { getPublicKey: () => Promise<string> } }).freighter
        : undefined;
      const fanAddress = freighter
        ? await freighter.getPublicKey().catch(() => 'fan_demo_address')
        : 'fan_demo_address';

      await cancelSubscriptionOnSoroban({
        fanAddress,
        creatorAddress: cancelTarget.creatorId,
        reason: 0,
      });

      setActiveList((prev: ActiveSubscription[]) =>
        prev.filter((s: ActiveSubscription) => s.id !== cancelTarget.id),
      );
      setCancelTarget(null);
      showInfo(
        'Subscription cancelled',
        `Access remains active until ${formatDate(cancelTarget.currentPeriodEnd)}. No refund is issued for the current period.`,
      );
    } catch {
      showError('TX_FAILED', subscriptionActionToast.cancelFailed());
    } finally {
      dismiss(loadingToastId);
      setIsCancelling(false);
    }
  }, [cancelTarget, dismiss, showError, showInfo, showLoading]);

  const handleRenewConfirm = useCallback(async () => {
    if (!renewTarget) return;
    setIsRenewing(true);
    setRenewingId(renewTarget.id);
    const loadingToastId = showLoading(`Renewing ${renewTarget.creatorName}...`);
    try {
      // Only active subscriptions carry a resolvable creator G-address today;
      // re-subscribing from history is a separate (checkout) flow, not a
      // contract-level renewal, so we don't attempt an on-chain call for it.
      if (!('creatorId' in renewTarget) || !renewTarget.creatorId) {
        throw new Error('Re-subscribing from history is not supported here yet.');
      }

      const freighter = typeof window !== 'undefined'
        ? (window as unknown as { freighter?: { getPublicKey: () => Promise<string> } }).freighter
        : undefined;
      const fanAddress = freighter
        ? await freighter.getPublicKey().catch(() => 'fan_demo_address')
        : 'fan_demo_address';

      // Plan metadata (token) isn't threaded through the fan-facing
      // ActiveSubscription shape yet — fall back to the configured MyFans
      // token contract, which is what plans are denominated in today.
      const tokenAddress = getStellarConfig().tokenContractId;

      await extendSubscriptionOnSoroban({
        fanAddress,
        creatorAddress: renewTarget.creatorId,
        tokenAddress,
      });

      showSuccess('Subscription renewed', `${renewTarget.creatorName} ${renewTarget.planName} is active again.`);

      // Refresh list after renewal
      const list = await fetchActiveSubscriptions({ status: statusFilter, sort: sortOption });
      setActiveList(list);
      setActiveListError(null);

      setRenewTarget(null);
    } catch {
      showError('TX_FAILED', subscriptionActionToast.renewFailed());
    } finally {
      dismiss(loadingToastId);
      setIsRenewing(false);
      setRenewingId(null);
    }
  }, [renewTarget, dismiss, showError, showSuccess, showLoading, statusFilter, sortOption]);

  const handleRenewClick = useCallback((item: ActiveSubscription | SubscriptionHistoryItem) => {
    setRenewTarget(item);
  }, []);

  const isRenewable = (item: ActiveSubscription | SubscriptionHistoryItem) => {
    // For active subscriptions, only allow renewal if they expire in less than 7 days
    if ('status' in item && item.status === 'active') {
      const expiry = new Date(item.currentPeriodEnd).getTime();
      const now = new Date().getTime();
      const diffDays = (expiry - now) / (1000 * 60 * 60 * 24);
      return diffDays < 7;
    }
    // For historical items, they are always renewable (re-subscribe)
    return true;
  };

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
              <label htmlFor="status-filter" className="sr-only">Filter by status</label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Filter by status"
              >
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <label htmlFor="sort-option" className="sr-only">Sort by</label>
              <select
                id="sort-option"
                value={sortOption}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortOption(e.target.value)}
                className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Sort subscriptions"
              >
                <option value="expiry">Sort by Expiry</option>
                <option value="created">Sort by Created</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-10">
        {/* Refuses to sign/submit cancel & renew transactions on a network mismatch. */}
        <NetworkMismatchBanner />

        {/* Active subscriptions */}
        <section aria-labelledby="active-heading">
          <h2 id="active-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Active subscriptions
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <ActiveSubscriptionSkeleton key={i} />
              ))}
            </div>
          ) : activeListError === 'unauthorized' ? (
            <EmptyState
              title="Sign in required"
              description="Your session has expired. Sign in again to see your active subscriptions."
              actionLabel="Sign in"
              actionHref="/auth/sign-in"
            />
          ) : activeListError === 'error' ? (
            <EmptyState
              title="Couldn't load subscriptions"
              description="Something went wrong while loading your subscriptions. Please try again."
            />
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
                        {formatCurrency(sub.price, sub.currency)}/{sub.interval} · Renews {formatDate(sub.currentPeriodEnd)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRenewClick(sub)}
                        disabled={renewingId === sub.id || !isRenewable(sub)}
                        title={!isRenewable(sub) ? "Renewal only available 7 days before expiry" : ""}
                        className="flex-shrink-0 px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {renewingId === sub.id ? 'Renewing...' : 'Renew'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCancelTarget(sub)}
                        className="flex-shrink-0 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
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
          {isHistoryLoading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <HistoryCardSkeleton key={i} />
              ))}
            </div>
          ) : historyList.length === 0 ? (
            <EmptyState
              title="No subscription history"
              description="Cancelled subscriptions will appear here."
            />
          ) : (
            <ul className="space-y-3">
              {historyList.map((item) => (
                <HistoryCard
                  key={item.id}
                  item={item}
                  isRenewing={renewingId === item.id}
                  onRenew={handleRenewClick}
                />
              ))}
            </ul>
          )}
        </section>

        {/* Payment history */}
        <section aria-labelledby="payments-heading">
          <h2 id="payments-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Payment history
          </h2>
          {isPaymentsLoading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <HistoryCardSkeleton key={i} />
              ))}
            </div>
          ) : paymentsList.length === 0 ? (
            <EmptyState
              title="No payments yet"
              description="Payment records will appear here when you subscribe to creators."
            />
          ) : (
            <ul className="space-y-3">
              {paymentsList.map((payment) => (
                <PaymentCard key={payment.id} payment={payment} />
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* Cancel confirmation modal */}
      <Modal
        isOpen={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title="Cancel subscription?"
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You will lose access to {cancelTarget?.creatorName}&apos;s {cancelTarget?.planName} content at the end of your current billing period ({cancelTarget && formatDate(cancelTarget.currentPeriodEnd)}). You can resubscribe anytime.
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-md px-3 py-2 mt-4">
              ⚠ No refund will be issued for the remaining days in the current period. Cancellation takes effect on-chain immediately.
            </p>
          </div>
          <div className="flex gap-3 justify-end pt-4">
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
        </div>
      </Modal>
      {/* Renew confirmation modal */}
      <Modal
        isOpen={renewTarget !== null}
        onClose={() => setRenewTarget(null)}
        title="Renew subscription?"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You are about to renew your subscription to {renewTarget?.creatorName} ({renewTarget?.planName}). This will trigger a transaction of {renewTarget && getCurrencySymbol(renewTarget.currency)}{renewTarget?.price.toFixed(2)} from your wallet.
          </p>
          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={() => setRenewTarget(null)}
              disabled={isRenewing}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRenewConfirm}
              disabled={isRenewing}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg disabled:opacity-50 min-w-[120px]"
            >
              {isRenewing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Renewing…
                </span>
              ) : (
                'Confirm Renewal'
              )}
            </button>
          </div>
        </div>
      </Modal>
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

function HistoryCard({
  item,
  isRenewing,
  onRenew,
}: {
  item: SubscriptionHistoryItem;
  isRenewing: boolean;
  onRenew: (item: SubscriptionHistoryItem) => void;
}) {
  return (
    <BaseCard padding="md">
      <p className="font-medium text-gray-900 dark:text-white">
        {item.creatorName} · {item.planName}
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
        {formatCurrency(item.price, item.currency)} · {formatDate(item.startedAt)} – {formatDate(item.endedAt)}
      </p>
      {item.cancelReason && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{item.cancelReason}</p>
      )}
      <button
        type="button"
        onClick={() => onRenew(item)}
        disabled={isRenewing}
        className="mt-3 rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
      >
        {isRenewing ? 'Renewing...' : 'Renew subscription'}
      </button>
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
          {formatCurrency(payment.amount, payment.currency)}
        </span>
        <span className={`text-sm capitalize ${statusColor}`}>{payment.status}</span>
      </div>
    </BaseCard>
  );
}
