// Error types
export type {
  ErrorCode,
  ErrorSeverity,
  ErrorCategory,
  AppError,
  ErrorAction,
  FieldError,
  TransactionErrorDetails,
  NetworkErrorDetails,
} from './errors';

export {
  createAppError,
  isNetworkError,
  isRecoverable,
  isOffline,
  getErrorFromUnknown,
} from './errors';
