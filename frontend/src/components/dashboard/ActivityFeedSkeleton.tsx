'use client';

import React from 'react';
import { BaseCard } from '@/components/cards';

const ITEM_COUNT = 5;

/**
 * Skeleton for activity feed. Matches list layout to prevent CLS.
 */
export function ActivityFeedSkeleton() {
  return (
    <BaseCard className="flex flex-col" padding="lg">
      <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
      <ul className="space-y-4" aria-hidden>
        {Array.from({ length: ITEM_COUNT }).map((_, i) => (
          <li key={i} className="flex gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="flex-1 min-w-0">
              <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
              <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
            <div className="flex-shrink-0 h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </li>
        ))}
      </ul>
    </BaseCard>
  );
}

export default ActivityFeedSkeleton;
