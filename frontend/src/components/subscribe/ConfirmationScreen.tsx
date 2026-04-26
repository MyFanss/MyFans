'use client';

import { SubscriptionPlan } from '@/types/subscribe';
import NetworkMismatchBanner from '@/components/NetworkMismatchBanner';
import { useNetworkGuard } from '@/hooks/useNetworkGuard';

interface ConfirmationScreenProps {
  plan: SubscriptionPlan;
  walletAddress: string;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
}

function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function ConfirmationScreen({
  plan,
  walletAddress,
  onConfirm,
  onCancel,
  disabled,
}: ConfirmationScreenProps) {
  const { mismatch } = useNetworkGuard();

  const billingLabel =
    plan.billingInterval === 'monthly'
      ? 'per month'
      : plan.billingInterval === 'yearly'
      ? 'per year'
      : 'one-time';

  return (
    <div className="space-y-4">
      {/* Plan details card */}
      <section 
        className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"
        role="region"
        aria-labelledby="subscription-details-title"
      >
        <h3 
          id="subscription-details-title"
          className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100"
        >
          Subscription Details
        </h3>

        <dl className="space-y-3">
          <div className="flex items-center justify-between">
            <dt className="text-sm text-slate-500 dark:text-slate-400">Creator</dt>
            <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {plan.creatorName}
            </dd>
          </div>

          <div className="flex items-center justify-between">
            <dt className="text-sm text-slate-500 dark:text-slate-400">Plan</dt>
            <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {plan.name}
            </dd>
          </div>

          <div className="border-t border-slate-100 pt-3 dark:border-slate-700" aria-hidden="true" />

          <div className="flex items-center justify-between">
            <dt className="text-sm text-slate-500 dark:text-slate-400">Price</dt>
            <dd className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {plan.price} {plan.currency}
            </dd>
          </div>

          <div className="flex items-center justify-between">
            <dt className="text-sm text-slate-500 dark:text-slate-400">Billing</dt>
            <dd className="text-sm font-medium text-slate-900 dark:text-slate-100 capitalize">
              {billingLabel}
            </dd>
          </div>

          <div className="border-t border-slate-100 pt-3 dark:border-slate-700" aria-hidden="true" />

          <div className="flex items-center justify-between">
            <dt className="text-sm text-slate-500 dark:text-slate-400">Wallet</dt>
            <dd 
              className="font-mono text-sm text-slate-700 dark:text-slate-300"
              aria-label={`Wallet address: ${walletAddress}`}
            >
              <span aria-hidden="true">{truncateAddress(walletAddress)}</span>
            </dd>
          </div>
        </dl>
      </section>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Cancel
        </button>
        {mismatch ? (
          <div className="flex-1">
            <NetworkMismatchBanner />
          </div>
        ) : (
          <button
            onClick={onConfirm}
            disabled={disabled}
            className="flex-1 rounded-lg bg-primary-500 px-4 py-3 font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-700"
          >
            Sign &amp; Subscribe
          </button>
        )}
      </div>
    </div>
  );
}
