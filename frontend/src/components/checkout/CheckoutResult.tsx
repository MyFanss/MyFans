'use client';

import { CheckoutResult } from '@/lib/checkout';

interface CheckoutResultProps {
  result: CheckoutResult;
  onClose?: () => void;
}

export default function CheckoutResultDisplay({ result, onClose }: CheckoutResultProps) {
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
  
  return (
    <div className={`rounded-lg border p-6 text-center ${
      isRejected 
        ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
        : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
    }`}>
      <div className="mb-4 flex justify-center">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${
          isRejected ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-red-100 dark:bg-red-900/30'
        }`}>
          {isRejected ? (
            <svg className="h-8 w-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : (
            <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
      </div>
      
      <h3 className={`mb-2 text-xl font-bold ${
        isRejected ? 'text-amber-800 dark:text-amber-200' : 'text-red-800 dark:text-red-200'
      }`}>
        {isRejected ? 'Transaction Rejected' : 'Transaction Failed'}
      </h3>
      
      <p className={`mb-4 ${
        isRejected ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'
      }`}>
        {result.message || result.error || 'An error occurred during the transaction.'}
      </p>
      
      {result.error && (
        <div className="mb-4 rounded bg-white p-3 dark:bg-slate-800">
          <p className="font-mono text-sm text-slate-900 dark:text-slate-100">
            {result.error}
          </p>
        </div>
      )}
      
      {onClose && (
        <button
          onClick={onClose}
          className={`mt-4 rounded-lg px-6 py-2 text-white ${
            isRejected 
              ? 'bg-amber-600 hover:bg-amber-700' 
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          Try Again
        </button>
      )}
    </div>
  );
}

