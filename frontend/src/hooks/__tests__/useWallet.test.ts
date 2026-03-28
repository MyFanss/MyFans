import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWallet } from '../useWallet';
import type { WalletType } from '@/types/wallet';

// Mock the wallet library
vi.mock('@/lib/wallet', () => ({
  connectWallet: vi.fn(),
  getConnectedAddress: vi.fn(),
  getAnyConnectedAddress: vi.fn(),
  isWalletConnected: vi.fn(),
  isAnyWalletConnected: vi.fn(),
  getWalletInstallUrl: vi.fn(),
  isWalletInstalled: vi.fn(),
}));

import {
  connectWallet,
  getAnyConnectedAddress,
  isWalletInstalled,
  getWalletInstallUrl,
} from '@/lib/wallet';

describe('useWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    (getAnyConnectedAddress as any).mockResolvedValue(null);
    (isWalletInstalled as any).mockImplementation((walletType: WalletType) => walletType === 'freighter');
    (getWalletInstallUrl as any).mockImplementation((walletType: WalletType) => {
      const urls = {
        freighter: 'https://freighter.app',
        lobstr: 'https://lobstr.co',
        walletconnect: null,
      };
      return urls[walletType];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderWalletHook = (options = {}) => {
    return renderHook(() => useWallet(options));
  };

  describe('initial state', () => {
    it('starts with disconnected state', () => {
      const { result } = renderWalletHook();

      expect(result.current.isConnected).toBe(false);
      expect(result.current.address).toBeNull();
      expect(result.current.walletType).toBeNull();
      expect(result.current.isModalOpen).toBe(false);
      expect(result.current.isReconnecting).toBe(false);
    });

    it('checks existing connection on mount', async () => {
      const mockConnected = {
        address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        walletType: 'freighter' as WalletType,
      };
      (getAnyConnectedAddress as any).mockResolvedValue(mockConnected);

      const { result } = renderWalletHook();

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
        expect(result.current.address).toBe(mockConnected.address);
        expect(result.current.walletType).toBe(mockConnected.walletType);
      });
    });
  });

  describe('connection', () => {
    const mockAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';

    it('connects to wallet successfully', async () => {
      (connectWallet as any).mockResolvedValue(mockAddress);

      const { result } = renderWalletHook();

      await act(async () => {
        await result.current.connect('freighter');
      });

      expect(connectWallet).toHaveBeenCalledWith('freighter');
      expect(result.current.isConnected).toBe(true);
      expect(result.current.address).toBe(mockAddress);
      expect(result.current.walletType).toBe('freighter');
    });

    it('handles connection failure', async () => {
      const mockError = new Error('Connection failed');
      (connectWallet as any).mockRejectedValue(mockError);

      const { result } = renderWalletHook();

      await act(async () => {
        await expect(result.current.connect('freighter')).rejects.toThrow('Connection failed');
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.connectionState.status).toBe('error');
    });

    it('sets connecting state during connection', async () => {
      (connectWallet as any).mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderWalletHook();

      act(() => {
        result.current.connect('freighter');
      });

      expect(result.current.connectionState.status).toBe('connecting');
    });
  });

  describe('disconnection', () => {
    it('disconnects wallet', async () => {
      const mockConnected = {
        address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        walletType: 'freighter' as WalletType,
      };
      (getAnyConnectedAddress as any).mockResolvedValue(mockConnected);

      const { result } = renderWalletHook();

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        result.current.disconnect();
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.address).toBeNull();
      expect(result.current.walletType).toBeNull();
      expect(result.current.isReconnecting).toBe(false);
    });
  });

  describe('reconnection', () => {
    const mockAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';

    it('attempts to reconnect when called', async () => {
      const mockConnected = {
        address: mockAddress,
        walletType: 'freighter' as WalletType,
      };
      (getAnyConnectedAddress as any).mockResolvedValue(mockConnected);

      const { result } = renderWalletHook();

      act(() => {
        result.current.reconnect();
      });

      await waitFor(() => {
        expect(result.current.isReconnecting).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
        expect(result.current.isReconnecting).toBe(false);
      });
    });

    it('respects reconnection attempt limits', async () => {
      (getAnyConnectedAddress as any).mockResolvedValue(null);

      const { result } = renderWalletHook({
        reconnectAttempts: 2,
        reconnectDelay: 100,
      });

      act(() => {
        result.current.reconnect();
      });

      await waitFor(() => {
        expect(result.current.isReconnecting).toBe(true);
      }, { timeout: 1000 });

      await waitFor(() => {
        expect(result.current.isReconnecting).toBe(false);
      }, { timeout: 1000 });

      expect(getAnyConnectedAddress).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('auto-reconnect', () => {
    const mockAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';

    it('auto-reconnects when enabled', async () => {
      // First call returns null (disconnected), second call returns connected
      (getAnyConnectedAddress as any)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          address: mockAddress,
          walletType: 'freighter' as WalletType,
        });

      const { result } = renderWalletHook({
        autoReconnect: true,
        reconnectDelay: 50,
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      }, { timeout: 1000 });
    });

    it('does not auto-reconnect when disabled', async () => {
      (getAnyConnectedAddress as any).mockResolvedValue(null);

      const { result } = renderWalletHook({
        autoReconnect: false,
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      }, { timeout: 1000 });

      expect(getAnyConnectedAddress).toHaveBeenCalledTimes(1); // Only initial check
    });
  });

  describe('modal management', () => {
    it('opens and closes modal', () => {
      const { result } = renderWalletHook();

      act(() => {
        result.current.openModal();
      });

      expect(result.current.isModalOpen).toBe(true);

      act(() => {
        result.current.closeModal();
      });

      expect(result.current.isModalOpen).toBe(false);
    });
  });

  describe('wallet utilities', () => {
    it('checks if wallet is installed', () => {
      const { result } = renderWalletHook();

      expect(result.current.isWalletInstalled('freighter')).toBe(true);
      expect(result.current.isWalletInstalled('lobstr')).toBe(false);
    });

    it('gets install URL for wallet', () => {
      const { result } = renderWalletHook();

      expect(result.current.getInstallUrl('freighter')).toBe('https://freighter.app');
      expect(result.current.getInstallUrl('lobstr')).toBe('https://lobstr.co');
      expect(result.current.getInstallUrl('walletconnect')).toBeNull();
    });
  });

  describe('wallet events', () => {
    it('listens for wallet account changes', async () => {
      const mockConnected = {
        address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        walletType: 'freighter' as WalletType,
      };

      const { result } = renderWalletHook({
        autoReconnect: true,
      });

      // Simulate account change event
      act(() => {
        window.dispatchEvent(new Event('freighter:accountChanged'));
      });

      // Should trigger reconnection check
      await waitFor(() => {
        expect(getAnyConnectedAddress).toHaveBeenCalled();
      });
    });

    it('listens for network changes', async () => {
      const { result } = renderWalletHook();

      act(() => {
        window.dispatchEvent(new Event('freighter:networkChanged'));
      });

      await waitFor(() => {
        expect(getAnyConnectedAddress).toHaveBeenCalled();
      });
    });
  });

  describe('cleanup', () => {
    it('cleans up event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderWalletHook();

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'freighter:accountChanged',
        expect.any(Function)
      );
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'freighter:networkChanged',
        expect.any(Function)
      );
    });

    it('cleans up timeouts on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const { unmount } = renderWalletHook();

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('configuration options', () => {
    it('uses custom reconnection settings', async () => {
      (getAnyConnectedAddress as any).mockResolvedValue(null);

      const { result } = renderWalletHook({
        reconnectAttempts: 5,
        reconnectDelay: 200,
      });

      act(() => {
        result.current.reconnect();
      });

      await waitFor(() => {
        expect(result.current.isReconnecting).toBe(false);
      }, { timeout: 2000 });

      expect(getAnyConnectedAddress).toHaveBeenCalledTimes(6); // Initial + 5 retries
    });
  });
});
