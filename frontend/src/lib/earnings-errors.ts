import { createAppError, type AppError } from '@/types/errors';

export class EarningsError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, any>,
  ) {
    super(message);
    this.name = 'EarningsError';
  }
}

export function handleEarningsError(error: unknown): AppError {
  if (error instanceof EarningsError) {
    return createAppError(error.code as any, {
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

    return createAppError('EARNINGS_ERROR', {
      message: error.message,
      severity: 'error',
    });
  }

  return createAppError('UNKNOWN_ERROR', {
    message: 'An unknown error occurred',
    severity: 'error',
  });
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
