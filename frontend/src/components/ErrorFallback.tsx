'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { AppError, ErrorAction } from '@/types/errors';

interface ErrorFallbackProps {
  /** The error to display */
  error: AppError;
  /** Reset handler to try again */
  onReset?: () => void;
  /** Custom reset button label */
  resetLabel?: string;
  /** Whether to show the error code */
  showErrorCode?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ErrorFallback - Displays a user-friendly error message
 *
 * Features:
 * - Shows error message and description
 * - Provides action buttons for recovery
 * - Focus management for accessibility
 * - Dark mode compatible
 *
 * @example
 * ```tsx
 * <ErrorFallback error={appError} onReset={() => reset()} />
 * ```
 */
export function ErrorFallback({
  error,
  onReset,
  resetLabel = 'Try again',
  showErrorCode = true,
  className = '',
}: ErrorFallbackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  // Focus management - focus the container when error appears
  useEffect(() => {
    // Focus the primary action button for keyboard users
    if (primaryButtonRef.current) {
      primaryButtonRef.current.focus();
    }
  }, []);

  // Get icon based on error category
  const getIcon = () => {
    switch (error.category) {
      case 'transaction':
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-12 w-12"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
        );
      case 'network':
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-12 w-12"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418"
            />
          </svg>
        );
      case 'wallet':
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-12 w-12"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 0 1-3-3V5.25A2.25 2.25 0 0 0 9.75 3H7.5a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h11.25a2.25 2.25 0 0 0 2.25-2.25V12Z"
            />
          </svg>
        );
      case 'auth':
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-12 w-12"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
            />
          </svg>
        );
      default:
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-12 w-12"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        );
    }
  };

  // Get color based on severity
  const getSeverityColor = () => {
    switch (error.severity) {
      case 'warning':
        return 'text-amber-500 dark:text-amber-400';
      case 'info':
        return 'text-blue-500 dark:text-blue-400';
      case 'error':
      default:
        return 'text-red-500 dark:text-red-400';
    }
  };

  const handleAction = useCallback(
    (action: ErrorAction) => {
      if (!action) return;

      switch (action.type) {
        case 'retry':
          onReset?.();
          break;
        case 'back':
          router.back();
          break;
        case 'dismiss':
          // Just call onReset to clear the error
          onReset?.();
          break;
        case 'navigate':
          if (action.href) {
            if (action.href.startsWith('http')) {
              window.open(action.href, '_blank', 'noopener,noreferrer');
            } else {
              router.push(action.href);
            }
          }
          break;
        case 'custom':
          action.handler?.();
          break;
      }
    },
    [onReset, router]
  );

  return (
    <div
      ref={containerRef}
      className={`flex min-h-[200px] flex-col items-center justify-center p-8 text-center ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <div className={`mb-4 ${getSeverityColor()}`}>{getIcon()}</div>

      <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
        {error.message}
      </h2>

      {error.description && (
        <p className="mb-4 max-w-md text-sm text-slate-600 dark:text-slate-400">
          {error.description}
        </p>
      )}

      {showErrorCode && (
        <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
          Error code: {error.code}
        </p>
      )}

      {error.actions && error.actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {error.actions.map((action, index) => (
            <button
              key={action.label}
              ref={action.primary ? primaryButtonRef : null}
              onClick={() => handleAction(action)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                action.primary
                  ? 'bg-primary-500 text-white hover:bg-primary-600 dark:bg-primary-600 dark:hover:bg-primary-700'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
              autoFocus={index === 0}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {!error.actions && onReset && (
        <button
          ref={primaryButtonRef}
          onClick={onReset}
          className="mt-4 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-offset-slate-900"
        >
          {resetLabel}
        </button>
      )}
    </div>
  );
}

/**
 * ErrorFallbackCompact - A more compact error display for inline use
 */
export function ErrorFallbackCompact({
  error,
  onReset,
  resetLabel = 'Retry',
  className = '',
}: ErrorFallbackProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20 ${className}`}
      role="alert"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="h-5 w-5 flex-shrink-0 text-red-500 dark:text-red-400"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
        />
      </svg>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-red-800 dark:text-red-200">
          {error.message}
        </p>
      </div>

      {onReset && (
        <button
          onClick={onReset}
          className="flex-shrink-0 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        >
          {resetLabel}
        </button>
      )}
    </div>
  );
}
