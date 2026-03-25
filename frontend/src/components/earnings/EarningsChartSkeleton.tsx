'use client';

import React from 'react';
import { BaseCard } from '@/components/cards';

/** Skeleton matching chart card layout to prevent CLS. */
export function EarningsChartSkeleton() {
  return (
    <BaseCard className="flex flex-col" padding="lg">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-9 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-9 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-9 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </div>
      <div className="h-[280px] w-full bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" aria-hidden />
    </BaseCard>
  );
}

export default EarningsChartSkeleton;
