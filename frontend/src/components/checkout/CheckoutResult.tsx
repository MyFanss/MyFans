'use client';

import { useRouter } from 'next/navigation';
import { CheckoutResult } from '@/lib/checkout';
import { createAppError } from '@/types/errors';
import TxFailureRecovery from './TxFailureRecovery';

interface CheckoutResultProps {
  result: CheckoutResult;
  onClose?: () => void;
  onRetry?: () => void;
}

export default function CheckoutResultDisplay({ result, onClose, onRetry }: CheckoutResultProps) {
  const router = useRouter();
  if (result.success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center dark:border-green-800 dark:bg-green-900/20">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        
        <h3 className="mb-2 text-xl font-bold text-green-800 dark:text-green-200">
          Subscription Successful!
        </h3>
        
        <p className="mb-4 text-green-700 dark:text-green-300">
          {result.message || 'You are now subscribed to this creator.'}
        </p>
        
        {result.txHash && (
          <div className="mb-4 rounded bg-white p-3 dark:bg-slate-800">
            <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Transaction Hash</p>
            <p className="font-mono text-sm text-slate-900 dark:text-slate-100 break-all">
              {result.txHash}
            </p>
          </div>
        )}
        
        {result.explorerUrl && (
          <a
            href={result.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-4 inline-flex items-center gap-2 text-sm text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
          >
            View in Explorer
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
        
        {onClose && (
          <button
            onClick={onClose}
            className="mt-4 rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700"
          >
            Done
          </button>
        )}
      </div>
    );
  }

  // Failure state
  const isRejected = result.status === 'rejected';
  const errorCode = isRejected ? 'TX_REJECTED' : 'TX_FAILED';
  const appError = createAppError(errorCode, {
    message: result.message ?? result.error ?? 'Transaction failed',
    description: result.error,
  });

  return (
    <div className="space-y-4">
      <TxFailureRecovery
        error={appError}
        onRetry={onRetry ?? (() => router.back())}
        onDismiss={onClose ?? (() => router.back())}
      />
    </div>
  );
}

