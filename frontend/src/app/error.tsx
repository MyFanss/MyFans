'use client';

import { useEffect, useRef } from 'react';
import { ErrorFallback } from '@/components/ErrorFallback';
import { createAppError, type AppError } from '@/types/errors';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * ErrorPage - Next.js error boundary page
 *
 * Displayed when an error occurs in a server component or during rendering.
 * This is a Next.js special file that catches errors at the route level.
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Focus the primary action button on mount
  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  // Log error in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by error boundary:', error);
    }
  }, [error]);

  // Convert to AppError
  const appError: AppError = createAppError('INTERNAL_ERROR', {
    message: error.message || 'An unexpected error occurred',
    description: 'Something went wrong. Please try again or contact support if the problem persists.',
    cause: error,
    context: {
      digest: error.digest,
    },
  });

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <ErrorFallback
        error={appError}
        onReset={reset}
        resetLabel="Try again"
      />
    </div>
  );
}
