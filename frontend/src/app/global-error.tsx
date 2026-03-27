'use client';

import { useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';

interface GlobalErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalErrorPage({ error, reset }: GlobalErrorPageProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const correlationId = error.digest ?? `global-${Date.now().toString(36)}`;

  useEffect(() => {
    logger.error('Global error boundary caught', error, correlationId);
  }, [error, correlationId]);

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  return (
    <html lang="en" data-theme="light">
      <body className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
          <div className="mb-6 text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-16 w-16">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>

          <h1 className="mb-2 text-2xl font-bold">Something went wrong</h1>
          <p className="mb-2 max-w-md text-slate-600 dark:text-slate-400">
            A critical error occurred. Please try refreshing or go back to the home page.
          </p>

          {error.digest && (
            <p className="mb-6 font-mono text-xs text-slate-400">
              ID: {error.digest}
            </p>
          )}

          {process.env.NODE_ENV === 'development' && (
            <div className="mb-6 max-w-lg overflow-auto rounded-lg bg-red-50 p-4 text-left">
              <p className="font-mono text-sm text-red-800">{error.message}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              ref={buttonRef}
              onClick={reset}
              className="rounded-lg bg-sky-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
            >
              Try again
            </button>
            <a
              href="/"
              className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
