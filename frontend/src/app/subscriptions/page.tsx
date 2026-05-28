'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  MOCK_HISTORY,
  MOCK_PAYMENTS,
  type ActiveSubscription,
  type SubscriptionHistoryItem,
  type PaymentRecord,
} from '@/lib/subscriptions';
import { formatCurrency, formatDate, getCurrencySymbol } from '@/lib/formatting';
import { BaseCard } from '@/components/cards/BaseCard';
import HistoryCardSkeleton from '@/components/ui/HistoryCardSkeleton';
import ActiveSubscriptionSkeleton from '@/components/ui/ActiveSubscriptionSkeleton';
import { useToast } from '@/contexts/ToastContext';
import { subscriptionActionToast, subscriptionsLoadFailed } from '@/lib/error-copy';
import { cancelSubscriptionOnSoroban } from '@/lib/stellar';

export default function SubscriptionsPage() {
  const { showInfo, showSuccess, showError, showLoading, dismiss } = useToast();
  const [activeList, setActiveList] = useState<ActiveSubscription[]>([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [sortOption, setSortOption] = useState('expiry');
  const [cancelTarget, setCancelTarget] = useState<ActiveSubscription | null>(null);
  const [renewTarget, setRenewTarget] = useState<ActiveSubscription | SubscriptionHistoryItem | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const cancelModalRef = useRef<HTMLDivElement>(null);
  const renewModalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const modalTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchSubscriptions = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ status: statusFilter, sort: sortOption });
        const res = await fetch(`/api/v1/subscriptions/me/list?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch subscriptions');
        const data = await res.json();
        if (mounted) {
          // API returns { data: [...], ... } paginated shape
          setActiveList(Array.isArray(data) ? data : (data.data ?? []));
        }
      } catch (err) {
        console.error(err);
        showError('NETWORK_ERROR', subscriptionsLoadFailed());
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    fetchSubscriptions();
    return () => { mounted = false; };
  }, [showError, sortOption, statusFilter]);

  // Modal focus management and keyboard handling
  useEffect(() => {
    const target = cancelTarget || renewTarget;
    if (!target) return;

    // Prevent background scroll
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    previousFocusRef.current = document.activeElement as HTMLElement;
    const modalRef = cancelTarget ? cancelModalRef : renewModalRef;
    const modalElement = modalRef.current;
    
    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const focusFirstElement = () => {
      const firstFocusable = modalElement?.querySelector<HTMLElement>(focusableSelector);
      firstFocusable?.focus();
    };

    // Focus first element after a brief delay
    const focusTimeout = setTimeout(focusFirstElement, 10);

    const handleModalKeyDown = (event: KeyboardEvent) => {
      if (!modalRef.current) return;

      if (event.key === 'Escape' && !isCancelling && !isRenewing) {
        setCancelTarget(null);
        setRenewTarget(null);
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      );
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleModalKeyDown);

    return () => {
      clearTimeout(focusTimeout);
      document.removeEventListener('keydown', handleModalKeyDown);
      modalTriggerRef.current?.focus();
      if (!modalTriggerRef.current) {
        previousFocusRef.current?.focus();
      }
    };
  }, [cancelTarget, renewTarget, isCancelling, isRenewing]);

  const handleCancelConfirm = useCallback(async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    const loadingToastId = showLoading(`Cancelling ${cancelTarget.creatorName}...`);
    try {
      // Derive fan address from connected wallet; fall back to demo address
      const fanAddress =
        typeof window !== 'undefined' &&
        (window as any).freighter
          ? await (window as any).freighter.getPublicKey().catch(() => 'fan_demo_address')
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
      // Simulation of contract call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      showSuccess('Subscription renewed', `${renewTarget.creatorName} ${renewTarget.planName} is active again.`);
      
      // Refresh list after renewal
      const params = new URLSearchParams({ status: statusFilter, sort: sortOption });
      const res = await fetch(`/api/v1/subscriptions/me/list?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setActiveList(Array.isArray(data) ? data : (data.data ?? []));
      }
      
      setRenewTarget(null);
    } catch {
      showError('TX_FAILED', subscriptionActionToast.renewFailed());
    } finally {
      dismiss(loadingToastId);
      setIsRenewing(false);
      setRenewingId(null);
    }
  }, [renewTarget, dismiss, showError, showSuccess, showLoading, statusFilter, sortOption]);

  const handleRenewClick = useCallback((item: ActiveSubscription | SubscriptionHistoryItem, event: React.MouseEvent) => {
    modalTriggerRef.current = event.currentTarget as HTMLElement;
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
                        onClick={(event) => handleRenewClick(sub, event)}
                        disabled={renewingId === sub.id || !isRenewable(sub)}
                        title={!isRenewable(sub) ? "Renewal only available 7 days before expiry" : ""}
                        className="flex-shrink-0 px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {renewingId === sub.id ? 'Renewing...' : 'Renew'}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          modalTriggerRef.current = event.currentTarget;
                          setCancelTarget(sub);
                        }}
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
          {MOCK_HISTORY.length === 0 ? (
            <EmptyState
              title="No subscription history"
              description="Cancelled subscriptions will appear here."
            />
          ) : (
            <ul className="space-y-3">
              {MOCK_HISTORY.map((item) => (
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
          aria-describedby="cancel-dialog-description"
        >
          <div 
            ref={cancelModalRef} 
            tabIndex={-1} 
            className="max-w-md w-full focus:outline-none"
          >
            <BaseCard padding="lg">
              <h3 id="cancel-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Cancel subscription?
              </h3>
              <p id="cancel-dialog-description" className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                You will lose access to {cancelTarget.creatorName}&apos;s {cancelTarget.planName} content at the end of your current billing period ({formatDate(cancelTarget.currentPeriodEnd)}). You can resubscribe anytime.
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-md px-3 py-2 mb-4">
                ⚠ No refund will be issued for the remaining days in the current period. Cancellation takes effect on-chain immediately.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  disabled={isCancelling}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  aria-disabled={isCancelling}
                >
                  Keep subscription
                </button>
                <button
                  type="button"
                  onClick={handleCancelConfirm}
                  disabled={isCancelling}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg disabled:opacity-50"
                  aria-disabled={isCancelling}
                >
                  {isCancelling ? 'Cancelling…' : 'Cancel subscription'}
                </button>
              </div>
            </BaseCard>
          </div>
        </div>
      )}
      {/* Renew confirmation modal */}
      {renewTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="renew-dialog-title"
        >
          <div ref={renewModalRef} tabIndex={-1} className="max-w-md w-full focus-visible:outline-none">
            <BaseCard padding="lg">
              <h3 id="renew-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Renew subscription?
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                You are about to renew your subscription to {renewTarget.creatorName} ({renewTarget.planName}). This will trigger a transaction of {getCurrencySymbol(renewTarget.currency)}{renewTarget.price.toFixed(2)} from your wallet.
              </p>
              <div className="flex gap-3 justify-end">
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
            </BaseCard>
          </div>
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

function HistoryCard({
  item,
  isRenewing,
  onRenew,
}: {
  item: SubscriptionHistoryItem;
  isRenewing: boolean;
  onRenew: (item: SubscriptionHistoryItem, event: React.MouseEvent) => void;
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
        onClick={(event) => onRenew(item, event)}
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
