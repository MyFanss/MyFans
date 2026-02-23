'use client';

import { TransactionPreview as TransactionPreviewType } from '@/lib/checkout';

interface TransactionPreviewProps {
  preview: TransactionPreviewType;
}

export default function TransactionPreview({ preview }: TransactionPreviewProps) {
  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
        Transaction Preview
      </h3>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-slate-600 dark:text-slate-400">From</span>
          <span className="font-mono text-sm text-slate-900 dark:text-slate-100">
            {formatAddress(preview.from)}
          </span>
        </div>
        
        <div className="flex items-center justify-center">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-slate-600 dark:text-slate-400">To</span>
          <span className="font-mono text-sm text-slate-900 dark:text-slate-100">
            {formatAddress(preview.to)}
          </span>
        </div>
        
        <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400">Asset</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {preview.asset.code}
            </span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-slate-600 dark:text-slate-400">Amount</span>
          <span className="text-slate-900 dark:text-slate-100">
            {preview.amount}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-slate-600 dark:text-slate-400">Fee</span>
          <span className="text-slate-900 dark:text-slate-100">
            {preview.fee}
          </span>
        </div>
        
        <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-900 dark:text-slate-100">Total</span>
            <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
              {preview.total} {preview.asset.code}
            </span>
          </div>
        </div>
        
        {preview.memo && (
          <div className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-400">
            Memo: {preview.memo}
          </div>
        )}
      </div>
    </div>
  );
}

