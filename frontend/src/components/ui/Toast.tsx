'use client';

import React from 'react';
import { useToast, type Toast } from '@/contexts/ToastContext';

export interface ToastContainerProps {
  toasts: Toast[];
  dismiss: (id: string) => void;
}

export function ToastContainer() {
  const { toasts, dismiss } = useToast();
  
  return (
    <div
      className="fixed right-0 top-0 z-[100] flex flex-col gap-2 p-4 md:p-6"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} dismiss={dismiss} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  dismiss: (id: string) => void;
}

function ToastItem({ toast, dismiss }: ToastItemProps) {
  const { title, description, visible, actionLabel, onAction, variant } = toast;

  const handleAction = () => {
    onAction?.();
    dismiss(toast.id);
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/40';
      case 'warning':
        return 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/40';
      case 'info':
        return 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/40';
      case 'loading':
        return 'border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-900/40';
      case 'error':
      default:
        return 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/40';
    }
  };

  const getIconColor = () => {
    switch (variant) {
      case 'success':
        return 'text-emerald-500 dark:text-emerald-400';
      case 'warning':
        return 'text-amber-500 dark:text-amber-400';
      case 'info':
        return 'text-blue-500 dark:text-blue-400';
      case 'loading':
        return 'text-violet-500 dark:text-violet-400';
      case 'error':
      default:
        return 'text-red-500 dark:text-red-400';
    }
  };

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={`pointer-events-auto w-80 max-w-full rounded-xl border p-4 shadow-xl backdrop-blur-sm transition-all duration-300 ${
        visible ? 'animate-toast-in opacity-100' : 'translate-x-full opacity-0'
      } ${getVariantStyles()}`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 mt-0.5 ${getIconColor()}`}>
          {variant === 'success' ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m6 2.25a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          ) : variant === 'warning' ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          ) : variant === 'info' ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
              />
            </svg>
          ) : variant === 'loading' ? (
            <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </p>
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {description}
            </p>
          )}
          {actionLabel && (
            <button
              onClick={handleAction}
              className="mt-3 text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
            >
              {actionLabel}
            </button>
          )}
        </div>

        <button
          onClick={() => dismiss(toast.id)}
          className="flex-shrink-0 -mt-1 -mr-1 p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Dismiss"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-4 w-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
