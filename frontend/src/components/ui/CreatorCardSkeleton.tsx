"use client"

import React from 'react';
import { BaseCard, BaseCardProps } from '../cards';

export const CreatorCardSkeleton: React.FC<Omit<BaseCardProps, 'children'>> = ({
  className = '',
  ...baseProps
}) => {
  return (
    <BaseCard className={`flex flex-col gap-4 animate-pulse ${className}`} padding="lg" {...baseProps}>
      {/* Header */}
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-gray-300 dark:bg-gray-700" />

        {/* Name and username */}
        <div className="flex-1 min-w-0 space-y-1 py-1">
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2" />
          <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded w-1/3" />
        </div>
      </div>

      {/* Bio */}
      <div className="space-y-1">
        <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-full" />
        <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-5/6" />
      </div>

      {/* Categories */}
      <div className="flex gap-2">
        <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded-full w-16" />
        <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded-full w-12" />
        <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded-full w-20" />
      </div>

      {/* Stats and action */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-16" />
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-12" />
        </div>
        <div className="h-8 w-20 bg-gray-300 dark:bg-gray-700 rounded" />
      </div>
    </BaseCard>
  );
};

export default CreatorCardSkeleton;