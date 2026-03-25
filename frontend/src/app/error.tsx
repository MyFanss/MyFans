'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorFallback } from '@/components/ErrorFallback';
import { createAppError, type AppError } from '@/types/errors';
import * as logger from '@/lib/logger';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    logger.logError({
      message: error.message || 'Unhandled route error',
      correlationId: error.digest,
      context: { digest: error.digest },
      error,
    });
  }, [error]);

  const router = useRouter();

  const appError: AppError = createAppError('INTERNAL_ERROR', {
    message: error.message || 'An unexpected error occurred',
    description: 'Something went wrong. Please try again or contact support if the problem persists.',
    cause: error,
    context: { digest: error.digest },
    actions: [
      { label: 'Try again', type: 'retry', primary: true },
      { label: 'Go home', type: 'navigate', href: '/' },
    ],
  });

  const handleReset = () => {
    reset();
    router.refresh();
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <ErrorFallback
        error={appError}
        onReset={handleReset}
        resetLabel="Try again"
      />
    </div>
  );
}
