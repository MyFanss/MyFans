'use client';

import React from 'react';
import { BaseCard } from '@/components/cards';

export interface DashboardErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function DashboardError({ message = 'Failed to load dashboard', onRetry }: DashboardErrorProps) {
  return (
    <BaseCard className="flex flex-col items-center justify-center text-center" padding="lg">
      <div
        className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 mb-4"
        aria-hidden
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Something went wrong</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-sm">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Try again
        </button>
      )}
    </BaseCard>
  );
}

export default DashboardError;
