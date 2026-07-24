import React from 'react';

function Bone({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
      aria-hidden="true"
    />
  );
}

/** Matches CreatorCard layout */
export function CreatorCardSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading creator"
      className="rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col gap-4"
    >
      <div className="flex items-start gap-4">
        <Bone className="w-16 h-16 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Bone className="h-5 w-32" />
          <Bone className="h-4 w-20" />
        </div>
      </div>
      <Bone className="h-4 w-full" />
      <Bone className="h-4 w-3/4" />
      <div className="flex gap-2">
        <Bone className="h-6 w-16 rounded-full" />
        <Bone className="h-6 w-16 rounded-full" />
      </div>
      <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
        <Bone className="h-4 w-24" />
        <Bone className="h-8 w-24 rounded" />
      </div>
    </div>
  );
}

/** Matches subscription list row layout */
export function SubscriptionRowSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading subscription"
      className="flex items-center gap-4 p-4 border-b border-gray-100 dark:border-gray-700"
    >
      <Bone className="w-10 h-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Bone className="h-4 w-40" />
        <Bone className="h-3 w-24" />
      </div>
      <Bone className="h-6 w-20 rounded-full" />
    </div>
  );
}

/** Matches ContentCard / post detail layout */
export function ContentDetailSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading content"
      className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      {/* Thumbnail */}
      <Bone className="w-full aspect-video rounded-none" />
      <div className="p-4 space-y-3">
        <Bone className="h-6 w-16 rounded-full" />
        <Bone className="h-5 w-3/4" />
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-5/6" />
        <div className="flex items-center gap-2 pt-1">
          <Bone className="w-6 h-6 rounded-full" />
          <Bone className="h-4 w-24" />
        </div>
        <div className="flex gap-4 pt-1">
          <Bone className="h-4 w-12" />
          <Bone className="h-4 w-12" />
          <Bone className="h-4 w-12" />
        </div>
      </div>
    </div>
  );
}

/** Renders n skeleton cards in a grid */
export function CreatorListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading creators"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {Array.from({ length: count }).map((_, i) => (
        <CreatorCardSkeleton key={i} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function SubscriptionListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading subscriptions">
      {Array.from({ length: count }).map((_, i) => (
        <SubscriptionRowSkeleton key={i} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
