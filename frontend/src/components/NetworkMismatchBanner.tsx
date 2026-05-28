'use client';

import { useNetworkGuard } from '@/hooks/useNetworkGuard';

/**
 * Renders a blocking banner when the connected wallet is on the wrong
 * Stellar network. Pass `children` to wrap pay-action buttons so they
 * are hidden while the mismatch is active.
 */
export default function NetworkMismatchBanner({
  children,
}: {
  children?: React.ReactNode;
}) {
  const { checking, mismatch, expected, detected } = useNetworkGuard();

  if (checking || !mismatch) {
    return <>{children}</>;
  }

  return (
    <div role="alert" aria-live="assertive" className="space-y-3">
      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-900/30">
        {/* Icon */}
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>

        <div className="text-sm">
          <p className="font-semibold text-amber-800 dark:text-amber-200">
            Wrong network
          </p>
          <p className="mt-1 text-amber-700 dark:text-amber-300">
            Your wallet is on{' '}
            <span className="font-mono font-medium">{detected}</span> but this
            app requires{' '}
            <span className="font-mono font-medium">{expected}</span>. Switch
            networks in Freighter to continue.
          </p>
        </div>
      </div>
    </div>
  );
}
