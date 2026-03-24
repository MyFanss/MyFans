'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as logger from '@/lib/logger';

interface DashboardErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardErrorPage({ error, reset }: DashboardErrorPageProps) {
  useEffect(() => {
    logger.logError({
      message: error.message || 'Dashboard error',
      correlationId: error.digest,
      context: { digest: error.digest, segment: 'dashboard' },
      error,
    });
  }, [error]);

  const router = useRouter();

  const handleReset = () => {
    reset();
    router.refresh();
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center" role="alert">
      <div className="mb-4 text-red-500" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-12 w-12">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      </div>
      <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">Dashboard error</h2>
      <p className="mb-6 max-w-sm text-sm text-gray-500 dark:text-gray-400">
        Something went wrong loading this page. Your data is safe.
      </p>
      {error.digest && (
        <p className="mb-4 font-mono text-xs text-slate-400" data-testid="correlation-id">
          Reference: {error.digest}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={handleReset}
          className="rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          Dashboard home
        </a>
      </div>
    </div>
  );
}
