'use client';

import { useRouter } from 'next/navigation';
import type { AppError } from '@/types/errors';
import { getRecoveryGuide, type RecoveryAction, type TxFailureType } from '@/lib/tx-recovery';

// ── Icons ──────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<TxFailureType, React.ReactNode> = {
  rejected_signature: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  ),
  network_congestion: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 0 0 4 4h9a5 5 0 1 0-.1-9.999 5.002 5.002 0 0 0-9.78 2.096A4.001 4.001 0 0 0 3 15Z" />
    </svg>
  ),
  insufficient_funds: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
    </svg>
  ),
  timeout: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
  rpc_error: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  ),
  offline: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3l18 18M8.111 8.111A5.97 5.97 0 0 0 6 12c0 1.657.672 3.157 1.757 4.243M12 20.485a9 9 0 0 1-6.364-2.636m0 0A9 9 0 0 1 3 12c0-2.485 1.008-4.736 2.636-6.364M12 3.515a9 9 0 0 1 6.364 2.636m0 0A9 9 0 0 1 21 12c0 2.485-1.008 4.736-2.636 6.364M12 8a4 4 0 0 1 4 4" />
    </svg>
  ),
  build_failed: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
    </svg>
  ),
  generic: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  ),
};

const TYPE_COLORS: Record<TxFailureType, { icon: string; badge: string; border: string; bg: string }> = {
  rejected_signature: {
    icon: 'text-amber-500 dark:text-amber-400',
    badge: 'bg-amber-100 dark:bg-amber-900/30',
    border: 'border-amber-200 dark:border-amber-800',
    bg: 'bg-amber-50 dark:bg-amber-950/20',
  },
  network_congestion: {
    icon: 'text-orange-500 dark:text-orange-400',
    badge: 'bg-orange-100 dark:bg-orange-900/30',
    border: 'border-orange-200 dark:border-orange-800',
    bg: 'bg-orange-50 dark:bg-orange-950/20',
  },
  insufficient_funds: {
    icon: 'text-red-500 dark:text-red-400',
    badge: 'bg-red-100 dark:bg-red-900/30',
    border: 'border-red-200 dark:border-red-800',
    bg: 'bg-red-50 dark:bg-red-950/20',
  },
  timeout: {
    icon: 'text-blue-500 dark:text-blue-400',
    badge: 'bg-blue-100 dark:bg-blue-900/30',
    border: 'border-blue-200 dark:border-blue-800',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
  },
  rpc_error: {
    icon: 'text-slate-500 dark:text-slate-400',
    badge: 'bg-slate-100 dark:bg-slate-800',
    border: 'border-slate-200 dark:border-slate-700',
    bg: 'bg-slate-50 dark:bg-slate-900/40',
  },
  offline: {
    icon: 'text-slate-500 dark:text-slate-400',
    badge: 'bg-slate-100 dark:bg-slate-800',
    border: 'border-slate-200 dark:border-slate-700',
    bg: 'bg-slate-50 dark:bg-slate-900/40',
  },
  build_failed: {
    icon: 'text-red-500 dark:text-red-400',
    badge: 'bg-red-100 dark:bg-red-900/30',
    border: 'border-red-200 dark:border-red-800',
    bg: 'bg-red-50 dark:bg-red-950/20',
  },
  generic: {
    icon: 'text-red-500 dark:text-red-400',
    badge: 'bg-red-100 dark:bg-red-900/30',
    border: 'border-red-200 dark:border-red-800',
    bg: 'bg-red-50 dark:bg-red-950/20',
  },
};

// ── Props ──────────────────────────────────────────────────────────────────

interface TxFailureRecoveryProps {
  /** The AppError from useTransaction */
  error: AppError;
  /** Called when user clicks a retry action */
  onRetry?: () => void;
  /** Called when user clicks dismiss/back */
  onDismiss?: () => void;
  /** Number of retries already attempted */
  retryCount?: number;
  /** Max retries allowed */
  maxRetries?: number;
  /** Extra CSS classes */
  className?: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function TxFailureRecovery({
  error,
  onRetry,
  onDismiss,
  retryCount = 0,
  maxRetries = 3,
  className = '',
}: TxFailureRecoveryProps) {
  const router = useRouter();
  const guide = getRecoveryGuide(error);
  const colors = TYPE_COLORS[guide.type];
  const retriesExhausted = retryCount >= maxRetries;

  const handleAction = (action: RecoveryAction) => {
    switch (action.kind) {
      case 'retry':
        onRetry?.();
        break;
      case 'back':
        onDismiss ? onDismiss() : router.back();
        break;
      case 'external':
        if (action.href) window.open(action.href, '_blank', 'noopener,noreferrer');
        break;
      case 'dismiss':
        onDismiss?.();
        break;
    }
  };

  return (
    <div
      className={`rounded-2xl border ${colors.border} ${colors.bg} p-5 ${className}`}
      role="alert"
      aria-live="assertive"
      data-testid="tx-failure-recovery"
      data-failure-type={guide.type}
    >
      {/* Icon + headline */}
      <div className="flex items-start gap-4 mb-4">
        <div className={`shrink-0 flex items-center justify-center w-14 h-14 rounded-full ${colors.badge} ${colors.icon}`}>
          {TYPE_ICONS[guide.type]}
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {guide.headline}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {guide.explanation}
          </p>
        </div>
      </div>

      {/* Recovery steps */}
      <ol className="mb-5 space-y-2 pl-1" aria-label="Recovery steps">
        {guide.steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${colors.badge} ${colors.icon}`}
              aria-hidden="true"
            >
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      {/* Retry exhausted warning */}
      {retriesExhausted && guide.canRetry && (
        <p className="mb-4 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
          You have retried {retryCount} times. If the issue persists, please go back and try again later.
        </p>
      )}

      {/* Error code (debug) */}
      <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
        Error: {error.code}
      </p>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {guide.actions.map((action) => {
          const isRetry = action.kind === 'retry';
          const disabled = isRetry && retriesExhausted;

          return (
            <button
              key={action.label}
              onClick={() => handleAction(action)}
              disabled={disabled}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${
                action.primary
                  ? 'bg-slate-900 text-white hover:bg-slate-700 focus:ring-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 dark:focus:ring-slate-100'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
              aria-label={action.label}
            >
              {action.kind === 'external' ? (
                <span className="flex items-center gap-1.5">
                  {action.label}
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </span>
              ) : action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
