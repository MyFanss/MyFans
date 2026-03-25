/**
 * Wallet session persistence utilities
 * Handles secure storage and retrieval of wallet session state
 */

import type { WalletConnectionState, WalletType } from '@/types/wallet';

/** Wallet session data structure */
export interface WalletSessionData {
  /** Wallet address */
  address: string;
  /** Wallet type */
  walletType: WalletType;
  /** Network name */
  network: string;
  /** Session timestamp */
  timestamp: number;
  /** Session expiration time (ms) */
  expiresAt: number;
}

/** Session storage configuration */
const SESSION_CONFIG = {
  /** Storage key for wallet session */
  STORAGE_KEY: 'myfans-wallet-session',
  /** Session duration in milliseconds (24 hours) */
  SESSION_DURATION: 24 * 60 * 60 * 1000,
  /** Grace period for session validation (5 minutes) */
  GRACE_PERIOD: 5 * 60 * 1000,
} as const;

/**
 * Save wallet session data to localStorage
 * 
 * @param sessionData - Wallet session data to save
 * @throws Error if storage fails
 */
export function saveWalletSession(sessionData: Omit<WalletSessionData, 'timestamp' | 'expiresAt'>): void {
  if (typeof window === 'undefined') {
    throw new Error('Cannot save session: window is not defined');
  }

  try {
    const now = Date.now();
    const fullSessionData: WalletSessionData = {
      ...sessionData,
      timestamp: now,
      expiresAt: now + SESSION_CONFIG.SESSION_DURATION,
    };

    const serialized = JSON.stringify(fullSessionData);
    localStorage.setItem(SESSION_CONFIG.STORAGE_KEY, serialized);
  } catch (error) {
    // Silently handle storage errors to avoid breaking the app
    console.warn('Failed to save wallet session:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Load wallet session data from localStorage
 * 
 * @returns Session data if valid and not expired, null otherwise
 * @throws Error if storage access fails
 */
export function loadWalletSession(): WalletSessionData | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const serialized = localStorage.getItem(SESSION_CONFIG.STORAGE_KEY);
    if (!serialized) {
      return null;
    }

    let sessionData: WalletSessionData;
    try {
      sessionData = JSON.parse(serialized) as WalletSessionData;
    } catch (parseError) {
      // Clear corrupted data
      localStorage.removeItem(SESSION_CONFIG.STORAGE_KEY);
      return null;
    }
    
    // Validate session structure
    if (!isValidSessionData(sessionData)) {
      clearWalletSession();
      return null;
    }

    // Check if session is expired
    const now = Date.now();
    if (now > sessionData.expiresAt) {
      clearWalletSession();
      return null;
    }

    return sessionData;
  } catch (error) {
    // Clear potentially corrupted data
    try {
      localStorage.removeItem(SESSION_CONFIG.STORAGE_KEY);
    } catch {
      // Ignore cleanup errors
    }
    return null;
  }
}

/**
 * Clear wallet session data from localStorage
 * 
 * @throws Error if storage access fails
 */
export function clearWalletSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(SESSION_CONFIG.STORAGE_KEY);
  } catch (error) {
    // Silently handle storage errors
    console.warn('Failed to clear wallet session:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Convert wallet session data to connection state
 * 
 * @param sessionData - Wallet session data
 * @returns Wallet connection state
 */
export function sessionToConnectionState(sessionData: WalletSessionData): WalletConnectionState {
  return {
    status: 'connected',
    address: sessionData.address,
    walletType: sessionData.walletType,
    network: sessionData.network,
  };
}

/**
 * Check if session data is valid
 * 
 * @param data - Data to validate
 * @returns True if data is valid session structure
 */
function isValidSessionData(data: any): data is WalletSessionData {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.address === 'string' &&
    typeof data.walletType === 'string' &&
    typeof data.network === 'string' &&
    typeof data.timestamp === 'number' &&
    typeof data.expiresAt === 'number' &&
    ['freighter', 'lobstr', 'walletconnect'].includes(data.walletType) &&
    data.address.length > 0 &&
    data.timestamp > 0 &&
    data.expiresAt > data.timestamp
  );
}

/**
 * Check if a session is stale (close to expiration)
 * 
 * @param sessionData - Session data to check
 * @returns True if session is stale
 */
export function isSessionStale(sessionData: WalletSessionData): boolean {
  const now = Date.now();
  const timeUntilExpiration = sessionData.expiresAt - now;
  return timeUntilExpiration <= SESSION_CONFIG.GRACE_PERIOD;
}

/**
 * Refresh session expiration time
 * 
 * @param sessionData - Current session data
 * @returns Updated session data with new expiration
 */
export function refreshSession(sessionData: WalletSessionData): WalletSessionData {
  const now = Date.now();
  return {
    ...sessionData,
    timestamp: now,
    expiresAt: now + SESSION_CONFIG.SESSION_DURATION,
  };
}

/**
 * Save refreshed session data
 * 
 * @param sessionData - Session data to refresh and save
 */
export function saveRefreshedSession(sessionData: WalletSessionData): void {
  const refreshedSession = refreshSession(sessionData);
  try {
    const serialized = JSON.stringify(refreshedSession);
    localStorage.setItem(SESSION_CONFIG.STORAGE_KEY, serialized);
  } catch (error) {
    // Silently handle storage errors to avoid breaking the app
    console.warn('Failed to save refreshed session:', error instanceof Error ? error.message : 'Unknown error');
  }
}
