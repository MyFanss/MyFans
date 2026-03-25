/**
 * Tests for wallet session persistence utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { WalletType } from '@/types/wallet';
import {
  saveWalletSession,
  loadWalletSession,
  clearWalletSession,
  sessionToConnectionState,
  isSessionStale,
  refreshSession,
  saveRefreshedSession,
  type WalletSessionData,
} from '@/lib/wallet-session';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock window object
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('wallet-session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearWalletSession();
  });

  const mockSessionData = {
    address: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
    walletType: 'freighter' as WalletType,
    network: 'Stellar Mainnet',
  };

  describe('saveWalletSession', () => {
    it('should save session data with timestamp and expiration', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      saveWalletSession(mockSessionData);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'myfans-wallet-session',
        expect.stringContaining(mockSessionData.address)
      );

      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(savedData.timestamp).toBe(now);
      expect(savedData.expiresAt).toBe(now + 24 * 60 * 60 * 1000);
    });

    it('should throw error when window is not defined', () => {
      const originalWindow = global.window;
      delete global.window;

      expect(() => saveWalletSession(mockSessionData)).toThrow(
        'Cannot save session: window is not defined'
      );

      global.window = originalWindow;
    });

    it('should handle localStorage failures gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(() => saveWalletSession(mockSessionData)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save wallet session:', 'Storage quota exceeded');
      
      consoleSpy.mockRestore();
    });
  });

  describe('loadWalletSession', () => {
    it('should load and return valid session data', () => {
      const now = Date.now();
      const sessionData: WalletSessionData = {
        ...mockSessionData,
        timestamp: now,
        expiresAt: now + 24 * 60 * 60 * 1000,
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(sessionData));

      const result = loadWalletSession();

      expect(result).toEqual(sessionData);
    });

    it('should return null when no session exists', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = loadWalletSession();

      expect(result).toBeNull();
    });

    it('should return null when window is not defined', () => {
      const originalWindow = global.window;
      delete global.window;

      const result = loadWalletSession();

      expect(result).toBeNull();

      global.window = originalWindow;
    });

    it('should clear and return null for invalid session data', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');

      const result = loadWalletSession();

      expect(result).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('myfans-wallet-session');
    });

    it('should clear and return null for expired session', () => {
      const now = Date.now();
      const expiredSession: WalletSessionData = {
        ...mockSessionData,
        timestamp: now - 24 * 60 * 60 * 1000,
        expiresAt: now - 1000, // Expired 1 second ago
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(expiredSession));

      const result = loadWalletSession();

      expect(result).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('myfans-wallet-session');
    });

    it('should clear and return null for malformed session data', () => {
      const malformedSession = {
        ...mockSessionData,
        address: '', // Invalid empty address
        timestamp: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(malformedSession));

      const result = loadWalletSession();

      expect(result).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('myfans-wallet-session');
    });
  });

  describe('clearWalletSession', () => {
    it('should remove session from localStorage', () => {
      clearWalletSession();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('myfans-wallet-session');
    });

    it('should not throw when window is not defined', () => {
      const originalWindow = global.window;
      delete global.window;

      expect(() => clearWalletSession()).not.toThrow();

      global.window = originalWindow;
    });
  });

  describe('sessionToConnectionState', () => {
    it('should convert session data to connection state', () => {
      const sessionData: WalletSessionData = {
        ...mockSessionData,
        timestamp: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };

      const result = sessionToConnectionState(sessionData);

      expect(result).toEqual({
        status: 'connected',
        address: mockSessionData.address,
        walletType: mockSessionData.walletType,
        network: mockSessionData.network,
      });
    });
  });

  describe('isSessionStale', () => {
    it('should return true for session near expiration', () => {
      const now = Date.now();
      const staleSession: WalletSessionData = {
        ...mockSessionData,
        timestamp: now,
        expiresAt: now + 4 * 60 * 1000, // 4 minutes until expiration (within grace period)
      };

      expect(isSessionStale(staleSession)).toBe(true);
    });

    it('should return false for fresh session', () => {
      const now = Date.now();
      const freshSession: WalletSessionData = {
        ...mockSessionData,
        timestamp: now,
        expiresAt: now + 23 * 60 * 60 * 1000, // 23 hours until expiration
      };

      expect(isSessionStale(freshSession)).toBe(false);
    });
  });

  describe('refreshSession', () => {
    it('should update session timestamp and expiration', () => {
      const now = Date.now();
      const oldSession: WalletSessionData = {
        ...mockSessionData,
        timestamp: now - 60 * 60 * 1000, // 1 hour ago
        expiresAt: now + 23 * 60 * 60 * 1000, // 23 hours from old timestamp
      };

      vi.spyOn(Date, 'now').mockReturnValue(now);

      const refreshed = refreshSession(oldSession);

      expect(refreshed.timestamp).toBe(now);
      expect(refreshed.expiresAt).toBe(now + 24 * 60 * 60 * 1000);
      expect(refreshed.address).toBe(oldSession.address);
      expect(refreshed.walletType).toBe(oldSession.walletType);
      expect(refreshed.network).toBe(oldSession.network);
    });
  });

  describe('saveRefreshedSession', () => {
    it('should save refreshed session data', () => {
      const now = Date.now();
      const sessionData: WalletSessionData = {
        ...mockSessionData,
        timestamp: now - 60 * 60 * 1000,
        expiresAt: now + 23 * 60 * 60 * 1000,
      };

      vi.spyOn(Date, 'now').mockReturnValue(now);

      saveRefreshedSession(sessionData);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'myfans-wallet-session',
        expect.stringContaining(mockSessionData.address)
      );

      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(savedData.timestamp).toBe(now);
      expect(savedData.expiresAt).toBe(now + 24 * 60 * 60 * 1000);
    });

    it('should handle save failures gracefully', () => {
      const sessionData: WalletSessionData = {
        ...mockSessionData,
        timestamp: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage failed');
      });

      expect(() => saveRefreshedSession(sessionData)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save refreshed session:', 'Storage failed');
      
      consoleSpy.mockRestore();
    });
  });

  describe('session validation', () => {
    it('should validate session structure correctly', () => {
      const validSession: WalletSessionData = {
        ...mockSessionData,
        timestamp: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(validSession));

      const result = loadWalletSession();

      expect(result).toEqual(validSession);
    });

    it('should reject session with invalid wallet type', () => {
      const invalidSession = {
        ...mockSessionData,
        walletType: 'invalid-wallet',
        timestamp: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(invalidSession));

      const result = loadWalletSession();

      expect(result).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalled();
    });

    it('should reject session with invalid timestamp', () => {
      const invalidSession = {
        ...mockSessionData,
        timestamp: -1,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(invalidSession));

      const result = loadWalletSession();

      expect(result).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalled();
    });
  });
});
