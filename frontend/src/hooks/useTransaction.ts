'use client';

import { useState, useCallback, useRef } from 'react';
import {
  type AppError,
  type ErrorCode,
  type TransactionErrorDetails,
  createAppError,
  getErrorFromUnknown,
  isOffline,
} from '@/types/errors';

/** Transaction state */
export type TransactionState = 'idle' | 'pending' | 'success' | 'failed';

/** Transaction options */
export interface TransactionOptions {
  /** Transaction type */
  type?: TransactionErrorDetails['txType'];
  /** Amount */
  amount?: number;
  /** Currency */
  currency?: string;
  /** Max retries on network failure */
  maxRetries?: number;
  /** Retry delay in ms */
  retryDelay?: number;
  /** Callback on success */
  onSuccess?: (result: unknown) => void;
  /** Callback on error */
  onError?: (error: AppError) => void;
  /** Callback on retry */
  onRetry?: (attempt: number) => void;
}

/** Transaction result */
export interface TransactionResult<T = unknown> {
  /** Current state */
  state: TransactionState;
  /** Result data */
  data: T | null;
  /** Error if failed */
  error: AppError | null;
  /** Transaction details */
  details: TransactionErrorDetails | null;
  /** Whether transaction is in progress */
  isPending: boolean;
  /** Whether transaction succeeded */
  isSuccess: boolean;
  /** Whether transaction failed */
  isFailed: boolean;
  /** Execute the transaction */
  execute: (fn: () => Promise<T>) => Promise<T | null>;
  /** Retry the last transaction */
  retry: () => Promise<T | null>;
  /** Reset state */
  reset: () => void;
  /** Number of retry attempts */
  retryCount: number;
}

/**
 * useTransaction - Hook for handling transaction state and errors
 *
 * @example
 * ```tsx
 * const tx = useTransaction({
 *   type: 'subscription',
 *   amount: 19.99,
 *   onSuccess: (result) => toast.success('Subscribed!'),
 * });
 *
 * <button onClick={() => tx.execute(() => subscribeToCreator(creatorId))}>
 *   {tx.isPending ? 'Processing...' : 'Subscribe'}
 * </button>
 *
 * {tx.error && <ErrorFallback error={tx.error} onReset={tx.reset} />}
 * ```
 */
export function useTransaction<T = unknown>(
  options: TransactionOptions = {}
): TransactionResult<T> {
  const {
    type,
    amount,
    currency = 'USD',
    maxRetries = 3,
    retryDelay = 1000,
    onSuccess,
    onError,
    onRetry,
  } = options;

  const [state, setState] = useState<TransactionState>('idle');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [details, setDetails] = useState<TransactionErrorDetails | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Store the last transaction function for retry
  const lastTransactionFn = useRef<(() => Promise<T>) | null>(null);

  // Determine error code from error
  const determineErrorCode = (err: unknown): ErrorCode => {
    if (isOffline()) {
      return 'OFFLINE';
    }

    if (err instanceof Error) {
      const message = err.message.toLowerCase();

      if (message.includes('insufficient') || message.includes('not enough')) {
        return 'INSUFFICIENT_BALANCE';
      }
      if (message.includes('rejected') || message.includes('denied') || message.includes('cancelled')) {
        return 'TX_REJECTED';
      }
      if (message.includes('timeout')) {
        return 'TX_TIMEOUT';
      }
      if (message.includes('network') || message.includes('rpc') || message.includes('fetch')) {
        return 'NETWORK_ERROR';
      }
      if (message.includes('fee')) {
        return 'NETWORK_FEE_ERROR';
      }
    }

    return 'TX_FAILED';
  };

  // Execute transaction
  const execute = useCallback(
    async (fn: () => Promise<T>): Promise<T | null> => {
      // Check if offline
      if (isOffline()) {
        const offlineError = createAppError('OFFLINE');
        setError(offlineError);
        setState('failed');
        onError?.(offlineError);
        return null;
      }

      // Store for retry
      lastTransactionFn.current = fn;

      setState('pending');
      setError(null);

      // Set transaction details
      if (type || amount) {
        setDetails({
          txType: type,
          amount,
          currency,
        });
      }

      try {
        const result = await fn();
        setData(result);
        setState('success');
        setRetryCount(0);
        onSuccess?.(result);
        return result;
      } catch (err) {
        const errorCode = determineErrorCode(err);
        const appError = createAppError(errorCode, {
          cause: err instanceof Error ? err : undefined,
          message: err instanceof Error ? err.message : String(err),
          context: {
            txType: type,
            amount,
            currency,
          },
        });

        setError(appError);
        setState('failed');
        onError?.(appError);
        return null;
      }
    },
    [type, amount, currency, onSuccess, onError]
  );

  // Retry transaction
  const retry = useCallback(async (): Promise<T | null> => {
    if (!lastTransactionFn.current) {
      return null;
    }

    const attempt = retryCount + 1;
    setRetryCount(attempt);
    onRetry?.(attempt);

    // Add delay before retry
    if (retryDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }

    // Check if max retries exceeded
    if (attempt > maxRetries) {
      const maxRetriesError = createAppError('NETWORK_ERROR', {
        message: 'Maximum retry attempts exceeded',
        context: {
          retryCount: attempt,
          maxRetries,
        },
      });
      setError(maxRetriesError);
      setState('failed');
      onError?.(maxRetriesError);
      return null;
    }

    return execute(lastTransactionFn.current);
  }, [retryCount, maxRetries, retryDelay, onRetry, execute, onError]);

  // Reset state
  const reset = useCallback(() => {
    setState('idle');
    setData(null);
    setError(null);
    setDetails(null);
    setRetryCount(0);
    lastTransactionFn.current = null;
  }, []);

  return {
    state,
    data,
    error,
    details,
    isPending: state === 'pending',
    isSuccess: state === 'success',
    isFailed: state === 'failed',
    execute,
    retry,
    reset,
    retryCount,
  };
}

/**
 * useNetworkStatus - Hook to track network status
 *
 * @example
 * ```tsx
 * const { isOnline, isOffline } = useNetworkStatus();
 *
 * if (isOffline) {
 *   return <OfflineBanner />;
 * }
 * ```
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });

  // Note: In a real implementation, you'd use useEffect to listen for
  // 'online' and 'offline' events. This is simplified for the hook structure.

  return {
    isOnline,
    isOffline: !isOnline,
  };
}

/**
 * Helper to wrap an async function with transaction handling
 */
export function withTransactionHandling<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: TransactionOptions = {}
): (...args: TArgs) => Promise<{ result: TResult | null; error: AppError | null }> {
  return async (...args: TArgs) => {
    try {
      if (isOffline()) {
        return {
          result: null,
          error: createAppError('OFFLINE'),
        };
      }

      const result = await fn(...args);
      options.onSuccess?.(result);
      return { result, error: null };
    } catch (err) {
      const error = getErrorFromUnknown(err);
      options.onError?.(error);
      return { result: null, error };
    }
  };
}
