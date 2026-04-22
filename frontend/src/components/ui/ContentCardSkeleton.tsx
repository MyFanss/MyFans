import React from 'react';
import { Skeleton } from './Skeleton';

/** Matches ContentCard layout to avoid CLS */
export function ContentCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900">
      {/* thumbnail — same aspect-video as ContentCard */}
      <div className="aspect-video w-full skeleton-shimmer" aria-hidden="true" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-3 w-16" rounded="full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <div className="flex items-center gap-2 pt-1">
          <Skeleton className="h-6 w-6" rounded="full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex items-center gap-4 pt-1">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
    </div>
  );
}
