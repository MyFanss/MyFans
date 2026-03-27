import React from 'react';
import { Skeleton } from './Skeleton';

/** Matches GatedContentViewer layout to avoid CLS */
export function ContentPageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* video player area */}
      <div className="aspect-video w-full skeleton-shimmer rounded-lg" aria-hidden="true" />

      <div className="mt-6 space-y-4">
        <Skeleton className="h-7 w-2/3" />

        {/* meta row */}
        <div className="flex gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>

        {/* action buttons */}
        <div className="flex gap-3">
          <Skeleton className="h-10 w-24" rounded="lg" />
          <Skeleton className="h-10 w-20" rounded="lg" />
        </div>

        {/* creator card */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12" rounded="full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-9 w-24" rounded="lg" />
        </div>

        {/* description */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/6" />
        </div>
      </div>
    </div>
  );
}
