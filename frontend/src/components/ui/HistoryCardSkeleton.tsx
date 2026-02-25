import React from 'react';
import { BaseCard, BaseCardProps } from '../cards';


export const HistoryCardSkeleton: React.FC<Omit<BaseCardProps, 'children'>> = ({
  className = '',
  ...baseProps
}) => {
  return (
    <BaseCard className={`animate-pulse ${className}`} padding="md" {...baseProps}>
      {/* Creator name & plan */}
      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-1" />

      {/* Price and dates */}
      <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-5/6 mb-1" />

      {/* Cancel reason (optional) */}
      <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded w-2/3" />
    </BaseCard>
  );
};

export default HistoryCardSkeleton;