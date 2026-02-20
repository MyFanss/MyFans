'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

/**
 * NotFoundPage - 404 error page
 *
 * Displayed when a route is not found.
 */
export default function NotFoundPage() {
  const buttonRef = useRef<HTMLAnchorElement>(null);

  // Focus the primary action button on mount
  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      {/* 404 Illustration */}
      <div className="mb-8">
        <div className="relative">
          <span className="text-[120px] font-bold text-slate-200 dark:text-slate-800">
            404
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.172 16.172a4 4 0 0 1 5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
        </div>
      </div>

      {/* Message */}
      <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
        Page not found
      </h1>
      <p className="mb-8 max-w-md text-slate-600 dark:text-slate-400">
        Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved or doesn&apos;t exist.
      </p>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          ref={buttonRef}
          href="/"
          className="rounded-lg bg-primary-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-offset-slate-900"
        >
          Go home
        </Link>
        <button
          onClick={() => window.history.back()}
          className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:focus:ring-offset-slate-900"
        >
          Go back
        </button>
      </div>

      {/* Help text */}
      <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
        If you think this is a bug, please{' '}
        <a
          href="mailto:support@myfans.app"
          className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300"
        >
          contact support
        </a>
        .
      </p>
    </div>
  );
}
