'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

/**
 * NotFoundPage - 404 error page
 *
 * Displayed when a route is not found.
 */
export default function NotFound() {
  const buttonRef = useRef<HTMLAnchorElement>(null);

  // Focus the primary action button on mount
  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center bg-gray-50 dark:bg-gray-900">
      {/* 404 Illustration */}
      <div className="mb-6 relative">
        <span className="text-[120px] font-bold text-gray-200 dark:text-gray-700">
          404
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.172 16.172a4 4 0 0 1 5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
      </div>

      {/* Message */}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Page not found
      </h1>
      <p className="mt-2 max-w-md text-gray-500 dark:text-gray-400">
        The page you’re looking for doesn’t exist, has been moved, or may have been deleted.
      </p>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
        <Link
          ref={buttonRef}
          href="/"
          className="rounded-lg bg-primary-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          Go home
        </Link>

        <button
          onClick={() => window.history.back()}
          className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:focus:ring-offset-gray-900"
        >
          Go back
        </button>
      </div>

      {/* Help text */}
      <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">
        If you believe this is a bug, please{' '}
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