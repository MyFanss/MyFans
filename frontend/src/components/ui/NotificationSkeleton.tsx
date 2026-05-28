import React from 'react';
import { Skeleton } from './Skeleton';

export const NotificationSkeleton: React.FC = () => {
  return (
    <div className="flex gap-4 p-4 border-b border-slate-100 dark:border-slate-800 last:border-0 bg-white dark:bg-gray-900 animate-pulse">
      {/* Icon/Avatar Placeholder */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700" />
      
      <div className="flex-1 space-y-2">
        {/* Title and Date */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-16" />
        </div>
        {/* Message snippet */}
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
};

export default NotificationSkeleton;
