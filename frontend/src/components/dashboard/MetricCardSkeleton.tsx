'use client';

import React from 'react';
import { BaseCard } from '@/components/cards';

/**
 * Skeleton for MetricCard. Matches card layout to prevent CLS.
 */
export function MetricCardSkeleton() {
  return (
    <BaseCard className="flex flex-col" padding="lg">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1" />
        </div>
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
      </div>
      <div className="h-8 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
      <div className="flex items-center gap-2">
        <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    </BaseCard>
  );
}

export default MetricCardSkeleton;
