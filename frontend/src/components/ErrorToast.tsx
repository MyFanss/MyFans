'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type { AppError, ErrorCode } from '@/types/errors';
import { createAppError } from '@/types/errors';

interface ToastOptions {
  /** Error code */
  code?: ErrorCode;
  /** Custom message */
  message?: string;
  /** Custom description */
  description?: string;
  /** Duration in ms (default: 5000, set to 0 for persistent) */
  duration?: number;
  /** Action button label */
  actionLabel?: string;
  /** Action handler */
  onAction?: () => void;
}

interface Toast extends ToastOptions {
  id: string;
  error: AppError;
  visible: boolean;
}

interface ToastContextValue {
  /** Show an error toast */
  showError: (error: AppError | ErrorCode, options?: ToastOptions) => string;
  /** Show a success toast */
  showSuccess: (message: string, description?: string) => string;
  /** Show a warning toast */
  showWarning: (message: string, description?: string) => string;
  /** Show an info toast */
  showInfo: (message: string, description?: string) => string;
  /** Dismiss a specific toast */
  dismiss: (id: string) => void;
  /** Dismiss all toasts */
  dismissAll: () => void;
  /** Current toasts */
  toasts: Toast[];
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/**
 * ToastProvider - Provides toast notification functionality
 *
 * @example
 * ```tsx
 * <ToastProvider>
 *   <App />
 * </ToastProvider>
 * ```
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showError = useCallback(
    (error: AppError | ErrorCode, options: ToastOptions = {}): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const appError =
        typeof error === 'string' ? createAppError(error, options) : error;

      const toast: Toast = {
        ...options,
        id,
        error: appError,
        visible: true,
      };

      setToasts((prev) => [...prev, toast]);

      // Auto-dismiss after duration
      const duration = options.duration ?? 5000;
      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) =>
            prev.map((t) => (t.id === id ? { ...t, visible: false } : t))
          );
          // Remove from DOM after animation
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
          }, 300);
        }, duration);
      }

      return id;
    },
    []
  );

  const showSuccess = useCallback(
    (message: string, description?: string): string => {
      return showError('UNKNOWN_ERROR', {
        message,
        description,
        duration: 3000,
      });
    },
    [showError]
  );

  const showWarning = useCallback(
    (message: string, description?: string): string => {
      return showError('UNKNOWN_ERROR', {
        message,
        description,
        duration: 4000,
      });
    },
    [showError]
  );

  const showInfo = useCallback(
    (message: string, description?: string): string => {
      return showError('UNKNOWN_ERROR', {
        message,
        description,
        duration: 3000,
      });
    },
    [showError]
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, visible: false } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const dismissAll = useCallback(() => {
    setToasts((prev) => prev.map((t) => ({ ...t, visible: false })));
    setTimeout(() => {
      setToasts([]);
    }, 300);
  }, []);

  return (
    <ToastContext.Provider
      value={{
        showError,
        showSuccess,
        showWarning,
        showInfo,
        dismiss,
        dismissAll,
        toasts,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/**
 * useToast - Hook to access toast functionality
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastContainerProps {
  toasts: Toast[];
  dismiss: (id: string) => void;
}

function ToastContainer({ toasts, dismiss }: ToastContainerProps) {
  return (
    <div
      className="fixed right-0 top-0 z-50 flex flex-col gap-2 p-4"
      aria-live="polite"
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
  const { error, visible, actionLabel, onAction } = toast;
  const toastRef = useRef<HTMLDivElement>(null);

  // Focus management for accessibility
  useEffect(() => {
    if (visible && toastRef.current) {
      toastRef.current.focus();
    }
  }, [visible]);

  const handleAction = () => {
    onAction?.();
    dismiss(toast.id);
  };

  // Get styles based on severity
  const getSeverityStyles = () => {
    switch (error.severity) {
      case 'warning':
        return 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20';
      case 'info':
        return 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20';
      case 'error':
      default:
        return 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20';
    }
  };

  const getIconColor = () => {
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

  return (
    <div
      ref={toastRef}
      role="alert"
      tabIndex={-1}
      className={`pointer-events-auto w-80 max-w-full rounded-lg border p-4 shadow-lg transition-all duration-300 ${
        visible ? 'animate-toast-in opacity-100' : 'translate-x-full opacity-0'
      } ${getSeverityStyles()}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 ${getIconColor()}`}>
          {error.severity === 'warning' ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          ) : error.severity === 'info' ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
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

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {error.message}
          </p>
          {error.description && (
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {error.description}
            </p>
          )}
          {actionLabel && (
            <button
              onClick={handleAction}
              className="mt-2 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
            >
              {actionLabel}
            </button>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={() => dismiss(toast.id)}
          className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          aria-label="Dismiss"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
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
