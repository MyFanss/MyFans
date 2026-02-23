'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { ErrorFallback } from './ErrorFallback';
import {
  createAppError,
  type AppError,
  type ErrorCode,
} from '@/types/errors';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback component */
  fallback?: ReactNode;
  /** Custom error handler */
  onError?: (error: AppError, errorInfo: ErrorInfo) => void;
  /** Error code to use for caught errors */
  errorCode?: ErrorCode;
  /** Whether to show reset button */
  showReset?: boolean;
  /** Custom reset handler */
  onReset?: () => void;
  /** Reset button label */
  resetLabel?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: AppError | null;
}

/**
 * ErrorBoundary - Catches React errors and displays fallback UI
 *
 * Features:
 * - Catches JavaScript errors in child components
 * - Logs errors for debugging
 * - Displays user-friendly error UI
 * - Supports reset functionality
 *
 * @example
 * ```tsx
 * <ErrorBoundary onError={(error) => logError(error)}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const appError = createAppError('UNKNOWN_ERROR', {
      message: error.message,
      cause: error,
    });

    return { hasError: true, error: appError };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, errorCode } = this.props;

    const appError = createAppError(errorCode ?? 'UNKNOWN_ERROR', {
      message: error.message,
      cause: error,
      context: {
        componentStack: errorInfo.componentStack,
      },
    });

    this.setState({ error: appError });

    // Call custom error handler
    onError?.(appError, errorInfo);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleReset = (): void => {
    const { onReset } = this.props;
    this.setState({ hasError: false, error: null });
    onReset?.();
  };

  override render(): ReactNode {
    const { children, fallback, showReset = true, resetLabel } = this.props;
    const { hasError, error } = this.state;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      return (
        <ErrorFallback
          error={error}
          onReset={showReset ? this.handleReset : undefined}
          resetLabel={resetLabel}
        />
      );
    }

    return children;
  }
}

/**
 * withErrorBoundary - HOC to wrap components with ErrorBoundary
 *
 * @example
 * ```tsx
 * const SafeComponent = withErrorBoundary(MyComponent, {
 *   onError: (error) => logError(error),
 * });
 * ```
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName ?? Component.name ?? 'Component'})`;

  return WrappedComponent;
}
