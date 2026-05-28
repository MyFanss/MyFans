import type { AppError, ErrorCode } from '@/types';
import { createAppError, isNetworkError, getErrorFromUnknown } from '@/types';

// Retry with exponential backoff + jitter for transient failures
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) throw error;
      
      // Check if recoverable (network, timeout, 5xx)
  const appError = getErrorFromUnknown(error);
      if (!appError.recoverable) throw error;
      
      // Exponential backoff with jitter: base * 2^(attempt-1) + random(0, base/2)
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * (baseDelay / 2);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Get auth headers (assumes localStorage 'authToken')
export function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

// Map fetch response/error to AppError
export function handleApiError(response: Response, url: string, cause?: Error): AppError {
  const details: any = { endpoint: url, statusCode: response.status };
  
  if (response.status >= 500) {
    return createAppError('SERVICE_UNAVAILABLE', { 
      cause, 
      context: details,
      recoverable: true 
    });
  }
  
  if (response.status === 401) {
    return createAppError('UNAUTHORIZED', { cause, context: details });
  }
  
  if (response.status === 403) {
    return createAppError('FORBIDDEN', { cause, context: details });
  }
  
  if (response.status === 429) {
    return createAppError('RATE_LIMITED', { cause, context: details, recoverable: true });
  }
  
  if (!response.ok) {
    return createAppError('INTERNAL_ERROR', { cause, context: details });
  }
  
  throw new Error('Unexpected response handling');
}

// Is transient/should retry
export function shouldRetry(error: AppError): boolean {
  return error.recoverable || 
         error.code.includes('NETWORK') || 
         error.code === 'RATE_LIMITED';
}

