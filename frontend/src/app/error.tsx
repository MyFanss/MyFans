'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorFallback } from '@/components/ErrorFallback';
import { createAppError } from '@/types/errors';
import { logger } from '@/lib/logger';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const router = useRouter();
  const correlationId = error.digest ?? `route-${Date.now().toString(36)}`;

  useEffect(() => {
    logger.error('Route error boundary caught', error, correlationId);
  }, [error, correlationId]);

  const appError = createAppError('INTERNAL_ERROR', {
    message: error.message || 'An unexpected error occurred',
    description: 'Something went wrong. Please try again or go home.',
    cause: error,
    context: { correlationId },
    actions: [
      { label: 'Try again', type: 'retry', primary: true },
      { label: 'Go home', type: 'navigate', href: '/' },
    ],
  });

  // Patch retry to call Next.js reset
  appError.actions = [
    { label: 'Try again', type: 'custom', primary: true, handler: reset },
    { label: 'Go home', type: 'custom', handler: () => router.push('/') },
  ];

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <ErrorFallback error={appError} />
      {process.env.NODE_ENV === 'development' && error.digest && (
        <p className="sr-only">Correlation ID: {error.digest}</p>
      )}
    </div>
  );
}
