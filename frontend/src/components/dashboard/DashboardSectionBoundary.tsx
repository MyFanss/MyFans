'use client';

import { type ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorFallbackCompact } from '@/components/ErrorFallback';
import { createAppError } from '@/types/errors';

interface DashboardSectionBoundaryProps {
  children: ReactNode;
  /** Section label used in the compact fallback message */
  label?: string;
  /** Called when the user clicks Retry */
  onReset?: () => void;
}

/**
 * DashboardSectionBoundary wraps an individual dashboard section so that a
 * runtime error in one section does not unmount the rest of the page.
 *
 * Uses ErrorFallbackCompact so the fallback is visually contained within the
 * section's own layout area.
 */
export function DashboardSectionBoundary({
  children,
  label = 'This section',
  onReset,
}: DashboardSectionBoundaryProps) {
  const fallbackError = createAppError('INTERNAL_ERROR', {
    message: `${label} failed to load`,
  });

  return (
    <ErrorBoundary
      errorCode="INTERNAL_ERROR"
      onReset={onReset}
      fallback={
        <ErrorFallbackCompact
          error={fallbackError}
          onReset={onReset}
          resetLabel="Retry"
        />
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export default DashboardSectionBoundary;
