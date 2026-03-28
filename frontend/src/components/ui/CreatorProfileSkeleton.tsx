import React from 'react';
import { Skeleton } from './Skeleton';
import { ContentCardSkeleton } from './ContentCardSkeleton';

/** Matches creator/[username] layout to avoid CLS */
export function CreatorProfileSkeleton() {
  return (
    <div>
      {/* hero banner */}
      <div className="h-40 sm:h-52 skeleton-shimmer" aria-hidden="true" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-16 sm:-mt-20 relative">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <Skeleton className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 border-4 border-white dark:border-gray-900" rounded="full" />
          <div className="pb-1 space-y-2 flex-1">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-full max-w-lg" />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 space-y-10">
        {/* plans */}
        <div className="space-y-4">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-9 w-full mt-2" rounded="lg" />
              </div>
            ))}
          </div>
        </div>

        {/* content grid */}
        <div className="space-y-4">
          <Skeleton className="h-5 w-24" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => <ContentCardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
