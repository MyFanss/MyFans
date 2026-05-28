import React from 'react';
import { BaseCard } from '../cards/BaseCard';
import { Skeleton } from './Skeleton';

export const ActiveSubscriptionSkeleton: React.FC = () => {
  return (
    <BaseCard padding="md" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex-1 space-y-2">
        {/* Creator Name and Plan */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        {/* Price, Interval and Expiry */}
        <Skeleton className="h-4 w-48" />
      </div>
      
      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-20 rounded-lg" />
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>
    </BaseCard>
  );
};

export default ActiveSubscriptionSkeleton;
