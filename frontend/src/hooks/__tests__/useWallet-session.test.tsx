/**
 * Integration tests for wallet session persistence with useWallet hook
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWallet } from '@/hooks/useWallet';
import {
  saveWalletSession,
  clearWalletSession,
  loadWalletSession,
} from '@/lib/wallet-session';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock window with Freighter API
const freighterMock = {
  getPublicKey: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

Object.defineProperty(window, 'freighter', {
  value: freighterMock,
  writable: true,
});

// Mock freighter events
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();

Object.defineProperty(window, 'addEventListener', {
  value: mockAddEventListener,
});

Object.defineProperty(window, 'removeEventListener', {
  value: mockRemoveEventListener,
});

describe('useWallet with session persistence', () => {
  const mockAddress = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';

  beforeEach(() => {
    vi.clearAllMocks();
    freighterMock.getPublicKey.mockResolvedValue(mockAddress);
  });

  afterEach(() => {
    clearWalletSession();
    vi.restoreAllMocks();
  });

  describe('session restoration on mount', () => {
    it('should restore wallet connection from valid session', async () => {
      // Save a valid session first
      saveWalletSession({
        address: mockAddress,
        walletType: 'freighter',
        network: 'Stellar Mainnet',
      });

      const { result } = renderHook(() => useWallet());

      // Wait for async operations
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.address).toBe(mockAddress);
      expect(result.current.walletType).toBe('freighter');
    });

    it('should not restore session if wallet address changed', async () => {
      // Save session with old address
      saveWalletSession({
        address: 'GOLDADDRESS123456789',
        walletType: 'freighter',
        network: 'Stellar Mainnet',
      });

      // Mock wallet returns different address
      freighterMock.getPublicKey.mockResolvedValue(mockAddress);

      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should clear old session but still connect with current wallet address
      expect(result.current.isConnected).toBe(true);
      expect(result.current.address).toBe(mockAddress);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('myfans-wallet-session');
    });

    it('should not restore session if wallet is not available', async () => {
      // Save a valid session
      saveWalletSession({
        address: mockAddress,
        walletType: 'freighter',
        network: 'Stellar Mainnet',
      });

      // Mock wallet not available
      Object.defineProperty(window, 'freighter', {
        value: undefined,
        writable: true,
      });

      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.isConnected).toBe(false);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('myfans-wallet-session');
    });

    it('should not restore session if wallet throws error', async () => {
      // Save a valid session
      saveWalletSession({
        address: mockAddress,
        walletType: 'freighter',
        network: 'Stellar Mainnet',
      });

      // Mock wallet throws error initially, then succeeds
      freighterMock.getPublicKey
        .mockRejectedValueOnce(new Error('Wallet locked'))
        .mockResolvedValueOnce(mockAddress);

      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should clear session but still connect when wallet becomes available
      expect(result.current.isConnected).toBe(true);
      expect(result.current.address).toBe(mockAddress);
    });

    it('should check existing connection if no session exists', async () => {
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(freighterMock.getPublicKey).toHaveBeenCalled();
      expect(result.current.isConnected).toBe(true);
      expect(result.current.address).toBe(mockAddress);
    });
  });

  describe('session persistence on connect', () => {
    it('should save session when wallet connects', async () => {
      const { result } = renderHook(() => useWallet());

      expect(result.current.isConnected).toBe(false);

      await act(async () => {
        await result.current.connect('freighter');
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.address).toBe(mockAddress);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'myfans-wallet-session',
        expect.stringContaining(mockAddress)
      );
    });

    it('should not save session if connection fails', async () => {
      freighterMock.getPublicKey.mockRejectedValue(new Error('Connection rejected'));

      const { result } = renderHook(() => useWallet());

      await act(async () => {
        try {
          await result.current.connect('freighter');
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.isConnected).toBe(false);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('session cleanup on disconnect', () => {
    it('should clear session when wallet disconnects', async () => {
      // Start with connected wallet
      saveWalletSession({
        address: mockAddress,
        walletType: 'freighter',
        network: 'Stellar Mainnet',
      });

      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.isConnected).toBe(true);

      // Disconnect wallet
      act(() => {
        result.current.disconnect();
      });

      expect(result.current.isConnected).toBe(false);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('myfans-wallet-session');
    });
  });

  describe('session refresh for stale sessions', () => {
    it('should refresh stale session during restoration', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      // Create a stale session (within grace period)
      const staleSession = {
        address: mockAddress,
        walletType: 'freighter' as const,
        network: 'Stellar Mainnet',
        timestamp: now - 23 * 60 * 60 * 1000, // 23 hours ago
        expiresAt: now + 4 * 60 * 1000, // 4 minutes from now (stale)
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(staleSession));

      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.address).toBe(mockAddress);

      // Should have saved refreshed session
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(savedData.timestamp).toBe(now);
      expect(savedData.expiresAt).toBe(now + 24 * 60 * 60 * 1000);
    });
  });

  describe('wallet change events', () => {
    it('should recheck connection on freighter account change', async () => {
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockAddEventListener).toHaveBeenCalledWith(
        'freighter:accountChanged',
        expect.any(Function)
      );

      // Simulate account change event
      const accountChangeHandler = mockAddEventListener.mock.calls[0][1];
      
      // Mock wallet returns different address after change
      freighterMock.getPublicKey.mockResolvedValue('GNEWADDRESS123456789');

      await act(async () => {
        accountChangeHandler();
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should update to new address
      expect(result.current.address).toBe('GNEWADDRESS123456789');
      expect(result.current.isConnected).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle localStorage errors gracefully', async () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage access denied');
      });

      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should still check wallet connection despite storage error
      expect(freighterMock.getPublicKey).toHaveBeenCalled();
      expect(result.current.isConnected).toBe(true);
    });

    it('should handle corrupted session data', async () => {
      localStorageMock.getItem.mockReturnValue('corrupted{json}');

      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.isConnected).toBe(true); // Should fall back to wallet check which succeeds
      expect(result.current.address).toBe(mockAddress);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('myfans-wallet-session');
    });
  });
});
