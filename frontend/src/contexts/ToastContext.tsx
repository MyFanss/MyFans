'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { AppError, ErrorCode } from '@/types/errors';
import { createAppError } from '@/types/errors';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface ToastOptions {
  code?: ErrorCode;
  message?: string;
  description?: string;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
  variant?: ToastVariant;
}

export interface Toast extends ToastOptions {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  visible: boolean;
}

interface ToastContextValue {
  showError: (error: AppError | ErrorCode, options?: ToastOptions) => string;
  showSuccess: (message: string, description?: string) => string;
  showWarning: (message: string, description?: string) => string;
  showInfo: (message: string, description?: string) => string;
  showLoading: (message: string, description?: string) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  toasts: Toast[];
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [announcement, setAnnouncement] = useState('');

  const createToast = useCallback((toast: Omit<Toast, 'id' | 'visible'>): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const duration = toast.duration ?? (toast.variant === 'loading' ? 0 : 4000);
    const nextToast: Toast = { ...toast, id, visible: true };

    setToasts((prev) => [...prev, nextToast]);
    setAnnouncement(toast.description ? `${toast.title}. ${toast.description}` : toast.title);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, visible: false } : t)));
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 250);
      }, duration);
    }

    return id;
  }, []);

  const showError = useCallback((error: AppError | ErrorCode, options: ToastOptions = {}): string => {
    const appError = typeof error === 'string' ? createAppError(error, options) : error;
    const variant = options.variant ?? (appError.severity === 'warning' ? 'warning' : appError.severity);
    return createToast({
      actionLabel: options.actionLabel,
      onAction: options.onAction,
      duration: options.duration,
      variant,
      title: options.message ?? appError.message,
      description: options.description ?? appError.description,
    });
  }, [createToast]);

  const showSuccess = useCallback(
    (message: string, description?: string): string => {
      return createToast({
        title: message,
        description,
        duration: 3000,
        variant: 'success',
      });
    },
    [createToast]
  );

  const showWarning = useCallback(
    (message: string, description?: string): string => {
      return createToast({
        title: message,
        description,
        duration: 4000,
        variant: 'warning',
      });
    },
    [createToast]
  );

  const showInfo = useCallback(
    (message: string, description?: string): string => {
      return createToast({
        title: message,
        description,
        duration: 3000,
        variant: 'info',
      });
    },
    [createToast]
  );

  const showLoading = useCallback(
    (message: string, description?: string): string => {
      return createToast({
        title: message,
        description,
        duration: 0,
        variant: 'loading',
      });
    },
    [createToast]
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
        showLoading,
        dismiss,
        dismissAll,
        toasts,
      }}
    >
      {children}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
