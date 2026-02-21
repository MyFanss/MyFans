'use client';

import { useEffect, useRef } from 'react';

interface GlobalErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * GlobalErrorPage - Catches errors in the root layout
 *
 * This is a special Next.js file that catches errors at the root level.
 * It must define its own <html> and <body> tags since the root layout may have crashed.
 */
export default function GlobalErrorPage({ error, reset }: GlobalErrorPageProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Focus the primary action button on mount
  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  // Log error in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('Global error caught:', error);
    }
  }, [error]);

  return (
    <html lang="en" data-theme="light">
      <body className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
          {/* Error Icon */}
          <div className="mb-6 text-red-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-16 w-16"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>

          {/* Message */}
          <h1 className="mb-2 text-2xl font-bold text-slate-900">
            Something went wrong
          </h1>
          <p className="mb-8 max-w-md text-slate-600">
            A critical error occurred. Please try refreshing the page or contact support if the problem persists.
          </p>

          {/* Error details in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-8 max-w-lg overflow-auto rounded-lg bg-red-50 p-4 text-left">
              <p className="font-mono text-sm text-red-800">
                {error.message}
              </p>
              {error.digest && (
                <p className="mt-2 font-mono text-xs text-red-600">
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              ref={buttonRef}
              onClick={reset}
              className="rounded-lg bg-primary-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              Refresh page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
