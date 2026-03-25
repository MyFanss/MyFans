'use client';

import React from 'react';

export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'pending';

export interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  showDot?: boolean;
  className?: string;
  'aria-label'?: string;
}

const statusConfig: Record<StatusType, { dot: string; text: string }> = {
  success: { dot: 'bg-green-500', text: 'text-green-700 dark:text-green-400' },
  warning: { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  error: { dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
  info: { dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400' },
  neutral: { dot: 'bg-gray-400 dark:bg-gray-500', text: 'text-gray-700 dark:text-gray-400' },
  pending: { dot: 'bg-gray-400 dark:bg-gray-500 animate-pulse', text: 'text-gray-600 dark:text-gray-400' },
};

export function StatusIndicator({
  status,
  label,
  showDot = true,
  className = '',
  'aria-label': ariaLabel,
}: StatusIndicatorProps) {
  const config = statusConfig[status];
  const labelText = label ?? status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm font-medium ${config.text} ${className}`}
      role="status"
      aria-label={ariaLabel ?? (label ? undefined : labelText)}
    >
      {showDot && (
        <span
          className={`flex-shrink-0 w-2 h-2 rounded-full ${config.dot}`}
          aria-hidden
        />
      )}
      {label && <span>{label}</span>}
    </span>
  );
}

export default StatusIndicator;
