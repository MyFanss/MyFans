import { createAppError, type AppError, type ErrorCode } from '@/types/errors';

export class EarningsError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'EarningsError';
  }
}

export function handleEarningsError(error: unknown): AppError {
  if (error instanceof EarningsError) {
    const normalizedCode = toErrorCode(error.code);
    return createAppError(normalizedCode, {
      message: error.message,
      severity: 'error',
    });
  }

  if (error instanceof Error) {
    if (error.message.includes('Insufficient balance')) {
      return createAppError('INSUFFICIENT_BALANCE', {
        message: 'Insufficient balance for withdrawal',
        description: error.message,
        severity: 'warning',
      });
    }

    if (error.message.includes('Invalid address')) {
      return createAppError('INVALID_ADDRESS', {
        message: 'Invalid withdrawal address',
        description: error.message,
        severity: 'warning',
      });
    }

    if (error.message.includes('Network')) {
      return createAppError('NETWORK_ERROR', {
        message: 'Network error',
        description: 'Failed to process earnings request. Please check your connection.',
        severity: 'error',
      });
    }

    return createAppError('INTERNAL_ERROR', {
      message: error.message,
      severity: 'error',
    });
  }

  return createAppError('UNKNOWN_ERROR', {
    message: 'An unknown error occurred',
    severity: 'error',
  });
}

const VALID_ERROR_CODES = new Set<ErrorCode>([
  'TX_FAILED',
  'TX_REJECTED',
  'TX_TIMEOUT',
  'INSUFFICIENT_BALANCE',
  'INSUFFICIENT_FUNDS',
  'INVALID_AMOUNT',
  'NETWORK_FEE_ERROR',
  'NETWORK_ERROR',
  'NETWORK_TIMEOUT',
  'RPC_ERROR',
  'CONNECTION_LOST',
  'OFFLINE',
  'WALLET_NOT_FOUND',
  'WALLET_NOT_CONNECTED',
  'WALLET_CONNECTION_FAILED',
  'WALLET_SIGNATURE_FAILED',
  'VALIDATION_ERROR',
  'REQUIRED_FIELD',
  'INVALID_FORMAT',
  'INVALID_EMAIL',
  'INVALID_ADDRESS',
  'PASSWORD_MISMATCH',
  'FIELD_TOO_SHORT',
  'FIELD_TOO_LONG',
  'UNAUTHORIZED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
  'RATE_LIMITED',
  'UNKNOWN_ERROR',
]);

function toErrorCode(code: string): ErrorCode {
  if (code === 'EARNINGS_ERROR') return 'INTERNAL_ERROR';
  return VALID_ERROR_CODES.has(code as ErrorCode) ? (code as ErrorCode) : 'INTERNAL_ERROR';
}

export const EARNINGS_ERROR_MESSAGES: Record<string, string> = {
  INSUFFICIENT_BALANCE: 'Your available balance is insufficient for this withdrawal.',
  INVALID_ADDRESS: 'The provided address is invalid. Please check and try again.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  WITHDRAWAL_FAILED: 'Withdrawal request failed. Please try again later.',
  INVALID_AMOUNT: 'Please enter a valid withdrawal amount.',
  INVALID_METHOD: 'Please select a valid withdrawal method.',
  API_ERROR: 'Failed to communicate with the server. Please try again.',
};
