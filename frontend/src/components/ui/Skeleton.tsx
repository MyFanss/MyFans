import React from 'react';

interface SkeletonProps {
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

export function Skeleton({ className = '', rounded = 'md' }: SkeletonProps) {
  const r = { sm: 'rounded-sm', md: 'rounded', lg: 'rounded-lg', full: 'rounded-full' }[rounded];
  return <div className={`skeleton-shimmer ${r} ${className}`} aria-hidden="true" />;
}
