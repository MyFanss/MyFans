/**
 * Error type definitions for the MyFans application.
 *
 * User-facing `message` and `description` defaults live in `getErrorDefaults` below.
 * Copy guidelines and flow-specific toast helpers: `@/lib/error-copy`.
 */

/** Base error codes for categorizing errors */
export type ErrorCode =
  // Transaction errors
  | 'TX_FAILED'
  | 'TX_BUILD_FAILED'
  | 'TX_SUBMIT_FAILED'
  | 'TX_REJECTED'
  | 'TX_TIMEOUT'
  | 'INSUFFICIENT_BALANCE'
  | 'INSUFFICIENT_FUNDS'
  | 'INVALID_AMOUNT'
  | 'NETWORK_FEE_ERROR'
  // Network errors
  | 'NETWORK_ERROR'
  | 'NETWORK_TIMEOUT'
  | 'RPC_ERROR'
  | 'CONNECTION_LOST'
  | 'OFFLINE'
  // Wallet errors
  | 'WALLET_NOT_FOUND'
  | 'WALLET_NOT_CONNECTED'
  | 'WALLET_CONNECTION_FAILED'
  | 'WALLET_SIGNATURE_FAILED'
  // Form errors
  | 'VALIDATION_ERROR'
  | 'REQUIRED_FIELD'
  | 'INVALID_FORMAT'
  | 'INVALID_EMAIL'
  | 'INVALID_ADDRESS'
  | 'PASSWORD_MISMATCH'
  | 'FIELD_TOO_SHORT'
  | 'FIELD_TOO_LONG'
  // Authentication errors
  | 'UNAUTHORIZED'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  // Server errors
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'RATE_LIMITED'
  // Form/Plan errors
  | 'SAVE_FAILED'
  | 'PUBLISH_FAILED'
  // Unknown
  | 'UNKNOWN_ERROR'
  // Product / UX-specific (toasts & inline recovery)
  | 'COPY_FAILED'
  | 'SAVE_FAILED'
  | 'PUBLISH_FAILED'
  | 'ACCESS_DENIED';

/** Error severity levels */
export type ErrorSeverity = 'error' | 'warning' | 'info';

/** Error categories for grouping */
export type ErrorCategory =
  | 'transaction'
  | 'network'
  | 'wallet'
  | 'form'
  | 'auth'
  | 'server'
  | 'unknown';

/** Base application error interface */
export interface AppError {
  /** Error code for programmatic handling */
  code: ErrorCode;
  /** Human-readable error message */
  message: string;
  /** More detailed description for help text */
  description?: string;
  /** Error severity */
  severity: ErrorSeverity;
  /** Error category */
  category: ErrorCategory;
  /** Whether the error is recoverable */
  recoverable: boolean;
  /** Suggested actions for the user */
  actions?: ErrorAction[];
  /** Original error for debugging */
  cause?: Error;
  /** Additional context */
  context?: Record<string, unknown>;
  /** Timestamp when error occurred */
  timestamp?: Date;
}

/** Action that can be taken to resolve an error */
export interface ErrorAction {
  /** Action label for button */
  label: string;
  /** Action type */
  type: 'retry' | 'back' | 'dismiss' | 'navigate' | 'custom';
  /** Navigation path for 'navigate' type */
  href?: string;
  /** Custom handler for 'custom' type */
  handler?: () => void | Promise<void>;
  /** Whether this is the primary action */
  primary?: boolean;
}

/** Form field error */
export interface FieldError {
  /** Field name */
  field: string;
  /** Error message */
  message: string;
  /** Error code */
  code: ErrorCode;
}

/** Transaction error details */
export interface TransactionErrorDetails {
  /** Transaction hash if available */
  txHash?: string;
  /** Transaction type */
  txType?: 'subscription' | 'tip' | 'purchase' | 'withdrawal' | 'refund';
  /** Amount involved */
  amount?: number;
  /** Currency */
  currency?: string;
  /** Required balance */
  requiredBalance?: number;
  /** Current balance */
  currentBalance?: number;
}

/** Network error details */
export interface NetworkErrorDetails {
  /** Endpoint that failed */
  endpoint?: string;
  /** HTTP status code */
  statusCode?: number;
  /** Response body */
  response?: unknown;
  /** Retry count */
  retryCount?: number;
}

/**
 * Create a standardized AppError from various error types
 */
export function createAppError(
  code: ErrorCode,
  options: Partial<Omit<AppError, 'code'>> = {}
): AppError {
  const defaults = getErrorDefaults(code);
  return {
    ...defaults,
    ...options,
    code,
    timestamp: options.timestamp ?? new Date(),
  };
}

/**
 * Get default values for an error code
 */
function getErrorDefaults(code: ErrorCode): Omit<AppError, 'code' | 'timestamp'> {
  const errorMap: Record<ErrorCode, Omit<AppError, 'code' | 'timestamp'>> = {
    // Transaction errors
    TX_FAILED: {
      message: 'Couldn’t complete on-chain action',
      description:
        'Open your wallet, approve any pending transaction, then try again. If nothing appears, refresh the page and reconnect your wallet.',
      severity: 'error',
      category: 'transaction',
      recoverable: true,
      actions: [
        { label: 'Try again', type: 'retry', primary: true },
        { label: 'Go back', type: 'back' },
      ],
    },
    TX_BUILD_FAILED: {
      message: 'Couldn’t build transaction',
      description:
        'Something went wrong assembling the payment. Go back one step, confirm amounts, then try again. Refresh if the problem continues.',
      severity: 'error',
      category: 'transaction',
      recoverable: true,
      actions: [
        { label: 'Try again', type: 'retry', primary: true },
        { label: 'Go back', type: 'back' },
      ],
    },
    TX_SUBMIT_FAILED: {
      message: 'Couldn’t submit to the network',
      description:
        'The chain didn’t accept the transaction yet. Wait a moment, check your wallet for status, then retry or submit again from checkout.',
      severity: 'error',
      category: 'transaction',
      recoverable: true,
      actions: [
        { label: 'Try again', type: 'retry', primary: true },
        { label: 'Go back', type: 'back' },
      ],
    },
    TX_REJECTED: {
      message: 'Transaction was declined',
      description:
        'You cancelled or your wallet blocked the request. Try again and approve when prompted, or switch wallet if the issue persists.',
      severity: 'warning',
      category: 'transaction',
      recoverable: true,
      actions: [
        { label: 'Try again', type: 'retry', primary: true },
        { label: 'Go back', type: 'back' },
      ],
    },
    TX_TIMEOUT: {
      message: 'Transaction is taking too long',
      description:
        'The network may be slow. Check your wallet activity for the latest status before sending another transaction.',
      severity: 'warning',
      category: 'transaction',
      recoverable: true,
      actions: [
        { label: 'Check status', type: 'custom', primary: true },
        { label: 'Go back', type: 'back' },
      ],
    },
    INSUFFICIENT_BALANCE: {
      message: 'Not enough balance',
      description:
        'Add funds to this wallet or pick another asset with enough balance, then continue. You can review balances in Settings.',
      severity: 'error',
      category: 'transaction',
      recoverable: false,
      actions: [
        { label: 'Add funds', type: 'navigate', href: '/settings#wallet', primary: true },
        { label: 'Go back', type: 'back' },
      ],
    },
    INSUFFICIENT_FUNDS: {
      message: 'Not enough funds',
      description:
        'Top up this account or choose a different asset, then try the payment again.',
      severity: 'error',
      category: 'transaction',
      recoverable: false,
      actions: [
        { label: 'Add funds', type: 'navigate', href: '/settings#wallet', primary: true },
        { label: 'Go back', type: 'back' },
      ],
    },
    INVALID_AMOUNT: {
      message: 'Invalid amount',
      description: 'Please enter a valid amount for this transaction.',
      severity: 'error',
      category: 'form',
      recoverable: true,
      actions: [{ label: 'Edit amount', type: 'back', primary: true }],
    },
    NETWORK_FEE_ERROR: {
      message: 'Network fee issue',
      description:
        'Fees are high or unavailable right now. Wait a minute, then retry. You can also try again when the network is less busy.',
      severity: 'error',
      category: 'network',
      recoverable: true,
      actions: [
        { label: 'Try again', type: 'retry', primary: true },
        { label: 'Go back', type: 'back' },
      ],
    },

    // Network errors
    NETWORK_ERROR: {
      message: 'Connection problem',
      description:
        'We couldn’t reach the server. Check your internet, then refresh this page. If you’re on Wi‑Fi, try again or switch networks.',
      severity: 'error',
      category: 'network',
      recoverable: true,
      actions: [
        { label: 'Try again', type: 'retry', primary: true },
        { label: 'Dismiss', type: 'dismiss' },
      ],
    },
    NETWORK_TIMEOUT: {
      message: 'Request timed out',
      description:
        'The server was slow to respond. Tap retry or refresh the page—often the next attempt succeeds.',
      severity: 'warning',
      category: 'network',
      recoverable: true,
      actions: [
        { label: 'Try again', type: 'retry', primary: true },
        { label: 'Dismiss', type: 'dismiss' },
      ],
    },
    RPC_ERROR: {
      message: 'Blockchain network error',
      description:
        'The Stellar endpoint had a problem. Wait a few seconds and try again. If it keeps failing, try again later.',
      severity: 'error',
      category: 'network',
      recoverable: true,
      actions: [
        { label: 'Try again', type: 'retry', primary: true },
        { label: 'Go back', type: 'back' },
      ],
    },
    CONNECTION_LOST: {
      message: 'Connection lost',
      description: 'Your internet connection was lost. Please reconnect and try again.',
      severity: 'error',
      category: 'network',
      recoverable: true,
      actions: [{ label: 'Reconnect', type: 'retry', primary: true }],
    },
    OFFLINE: {
      message: 'You are offline',
      description: 'Please check your internet connection and try again.',
      severity: 'warning',
      category: 'network',
      recoverable: true,
      actions: [{ label: 'Retry', type: 'retry', primary: true }],
    },

    // Wallet errors
    WALLET_NOT_FOUND: {
      message: 'Wallet not found',
      description: 'Please install a compatible wallet extension to continue.',
      severity: 'error',
      category: 'wallet',
      recoverable: false,
      actions: [
        { label: 'Get Freighter', type: 'navigate', href: 'https://freighter.app', primary: true },
      ],
    },
    WALLET_NOT_CONNECTED: {
      message: 'Wallet not connected',
      description: 'Please connect your wallet to continue.',
      severity: 'warning',
      category: 'wallet',
      recoverable: true,
      actions: [{ label: 'Connect wallet', type: 'custom', primary: true }],
    },
    WALLET_CONNECTION_FAILED: {
      message: 'Couldn’t connect wallet',
      description:
        'Unlock your wallet extension or app, then tap Connect again. If it still fails, refresh the page or reinstall the wallet.',
      severity: 'error',
      category: 'wallet',
      recoverable: true,
      actions: [
        { label: 'Try again', type: 'retry', primary: true },
        { label: 'Dismiss', type: 'dismiss' },
      ],
    },
    WALLET_SIGNATURE_FAILED: {
      message: 'Couldn’t sign transaction',
      description:
        'Approve the signature in your wallet when prompted. If you cancelled, try again and confirm.',
      severity: 'error',
      category: 'wallet',
      recoverable: true,
      actions: [
        { label: 'Try again', type: 'retry', primary: true },
        { label: 'Go back', type: 'back' },
      ],
    },

    // Form errors
    VALIDATION_ERROR: {
      message: 'Fix the form to continue',
      description:
        'Review the highlighted fields, correct any errors, then save or submit again.',
      severity: 'warning',
      category: 'form',
      recoverable: true,
      actions: [{ label: 'Fix errors', type: 'back', primary: true }],
    },
    REQUIRED_FIELD: {
      message: 'Required field',
      description: 'This field is required.',
      severity: 'warning',
      category: 'form',
      recoverable: true,
    },
    INVALID_FORMAT: {
      message: 'Invalid format',
      description: 'Please enter a valid value.',
      severity: 'warning',
      category: 'form',
      recoverable: true,
    },
    INVALID_EMAIL: {
      message: 'Invalid email',
      description: 'Please enter a valid email address.',
      severity: 'warning',
      category: 'form',
      recoverable: true,
    },
    INVALID_ADDRESS: {
      message: 'Invalid address',
      description: 'Please enter a valid Stellar address.',
      severity: 'warning',
      category: 'form',
      recoverable: true,
    },
    PASSWORD_MISMATCH: {
      message: 'Passwords do not match',
      description: 'Please make sure both passwords are identical.',
      severity: 'warning',
      category: 'form',
      recoverable: true,
    },
    FIELD_TOO_SHORT: {
      message: 'Too short',
      description: 'This value is too short.',
      severity: 'warning',
      category: 'form',
      recoverable: true,
    },
    FIELD_TOO_LONG: {
      message: 'Too long',
      description: 'This value is too long.',
      severity: 'warning',
      category: 'form',
      recoverable: true,
    },

    // Authentication errors
    UNAUTHORIZED: {
      message: 'Unauthorized',
      description: 'Please sign in to access this content.',
      severity: 'warning',
      category: 'auth',
      recoverable: true,
      actions: [{ label: 'Sign in', type: 'custom', primary: true }],
    },
    SESSION_EXPIRED: {
      message: 'Session expired',
      description: 'Your session has expired. Please sign in again.',
      severity: 'warning',
      category: 'auth',
      recoverable: true,
      actions: [{ label: 'Sign in', type: 'custom', primary: true }],
    },
    FORBIDDEN: {
      message: 'Access denied',
      description: 'You do not have permission to access this content.',
      severity: 'error',
      category: 'auth',
      recoverable: false,
      actions: [{ label: 'Go back', type: 'back', primary: true }],
    },

    // Server errors
    NOT_FOUND: {
      message: 'Not found',
      description: 'The requested resource could not be found.',
      severity: 'error',
      category: 'server',
      recoverable: false,
      actions: [
        { label: 'Go home', type: 'navigate', href: '/', primary: true },
        { label: 'Go back', type: 'back' },
      ],
    },
    INTERNAL_ERROR: {
      message: 'Something went wrong on our side',
      description:
        'Wait a moment and try again. If this keeps happening, refresh the page or come back later.',
      severity: 'error',
      category: 'server',
      recoverable: true,
      actions: [
        { label: 'Try again', type: 'retry', primary: true },
        { label: 'Go back', type: 'back' },
      ],
    },
    SERVICE_UNAVAILABLE: {
      message: 'Service unavailable',
      description: 'The service is temporarily unavailable. Please try again later.',
      severity: 'error',
      category: 'server',
      recoverable: true,
      actions: [
        { label: 'Try again', type: 'retry', primary: true },
        { label: 'Dismiss', type: 'dismiss' },
      ],
    },
    RATE_LIMITED: {
      message: 'Too many requests',
      description: 'Please wait a moment before trying again.',
      severity: 'warning',
      category: 'server',
      recoverable: true,
      actions: [{ label: 'Try again', type: 'retry', primary: true }],
    },
    SAVE_FAILED: {
      message: 'Save failed',
      description: 'The changes could not be saved. Please try again.',
      severity: 'error',
      category: 'form',
      recoverable: true,
      actions: [{ label: 'Try again', type: 'retry', primary: true }],
    },
    PUBLISH_FAILED: {
      message: 'Publish failed',
      description: 'The plan could not be published. Please try again.',
      severity: 'error',
      category: 'form',
      recoverable: true,
      actions: [{ label: 'Try again', type: 'retry', primary: true }],
    },

    COPY_FAILED: {
      message: 'Couldn’t copy to clipboard',
      description:
        'Select the text and copy manually (Ctrl+C or ⌘C), or allow clipboard access for this site in your browser settings.',
      severity: 'warning',
      category: 'unknown',
      recoverable: true,
      actions: [{ label: 'Dismiss', type: 'dismiss', primary: true }],
    },
    SAVE_FAILED: {
      message: 'Couldn’t save changes',
      description:
        'Check your connection and tap Save again. If the page looks stale, refresh once, re-enter changes, then save.',
      severity: 'error',
      category: 'server',
      recoverable: true,
      actions: [
        { label: 'Try again', type: 'retry', primary: true },
        { label: 'Dismiss', type: 'dismiss' },
      ],
    },
    PUBLISH_FAILED: {
      message: 'Couldn’t publish plan',
      description:
        'Keep your wallet connected, approve any prompts, then tap Publish again. If your wallet shows an error, fix that first and retry.',
      severity: 'error',
      category: 'transaction',
      recoverable: true,
      actions: [
        { label: 'Try again', type: 'retry', primary: true },
        { label: 'Go back', type: 'back' },
      ],
    },
    ACCESS_DENIED: {
      message: 'Couldn’t verify access',
      description:
        'Subscribe to this creator to unlock content, or refresh if you already subscribed. You can also reconnect your wallet and try again.',
      severity: 'warning',
      category: 'auth',
      recoverable: true,
      actions: [
        { label: 'View subscribe', type: 'navigate', href: '/subscribe', primary: true },
        { label: 'Dismiss', type: 'dismiss' },
      ],
    },

    // Unknown
    UNKNOWN_ERROR: {
      message: 'Something unexpected happened',
      description:
        'Try the action again. If it keeps failing, refresh the page or reconnect your wallet.',
      severity: 'error',
      category: 'unknown',
      recoverable: true,
      actions: [
        { label: 'Try again', type: 'retry', primary: true },
        { label: 'Dismiss', type: 'dismiss' },
      ],
    },
  };

  return errorMap[code] ?? errorMap.UNKNOWN_ERROR;
}

/**
 * Check if an error is a network error
 */
export function isNetworkError(error: AppError): boolean {
  return error.category === 'network';
}

/**
 * Check if an error is recoverable
 */
export function isRecoverable(error: AppError): boolean {
  return error.recoverable;
}

/**
 * Check if the user is offline
 */
export function isOffline(): boolean {
  if (typeof navigator === 'undefined') return false;
  return !navigator.onLine;
}

/**
 * Get error from unknown value
 */
export function getErrorFromUnknown(error: unknown): AppError {
  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes('insufficient')) {
      return createAppError('INSUFFICIENT_BALANCE', { cause: error });
    }
    if (error.message.includes('rejected') || error.message.includes('denied')) {
      return createAppError('TX_REJECTED', { cause: error });
    }
    if (error.message.includes('timeout')) {
      return createAppError('NETWORK_TIMEOUT', { cause: error });
    }
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return createAppError('NETWORK_ERROR', { cause: error });
    }

    return createAppError('UNKNOWN_ERROR', {
      message: error.message,
      cause: error,
    });
  }

  return createAppError('UNKNOWN_ERROR', {
    message: String(error),
  });
}
