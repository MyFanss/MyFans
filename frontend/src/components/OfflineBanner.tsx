'use client';

import React from 'react';
import type { RpcStatus } from '@/hooks/useRpcStatus';

interface OfflineBannerProps {
  status: RpcStatus;
  onRetry?: () => void;
}

const MESSAGES: Record<Exclude<RpcStatus, 'online' | 'checking'>, { title: string; description: string }> = {
  offline: {
    title: 'You are offline',
    description: 'Check your internet connection. Transactions and live data are unavailable.',
  },
  rpc_down: {
    title: 'Blockchain network unavailable',
    description: 'The Stellar RPC endpoint is unreachable. Transactions are paused until the connection is restored.',
  },
};

/**
 * OfflineBanner – a sticky top banner shown when the browser is offline
 * or the Soroban RPC endpoint is unreachable.
 */
export function OfflineBanner({ status, onRetry }: OfflineBannerProps) {
  if (status === 'online' || status === 'checking') return null;

  const { title, description } = MESSAGES[status];

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="sticky top-0 z-50 w-full bg-amber-500 dark:bg-amber-600 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-md"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>

        <div className="min-w-0">
          <span className="font-semibold text-sm">{title}</span>
          <span className="hidden sm:inline text-sm font-normal opacity-90 ml-1.5">
            {description}
          </span>
        </div>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 text-sm font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
        >
          Retry
        </button>
      )}
    </div>
  );
}
