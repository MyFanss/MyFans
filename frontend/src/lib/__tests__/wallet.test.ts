import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  connectWallet,
  signTransaction,
  getConnectedAddress,
  getAnyConnectedAddress,
  isWalletConnected,
  isAnyWalletConnected,
  isWalletInstalled,
  getWalletInstallUrl,
  connectWalletLegacy,
  signTransactionLegacy,
  getConnectedAddressLegacy,
  isWalletConnectedLegacy,
} from '../wallet';
import { createAppError } from '@/types/errors';

// Mock window object
const mockFreighter = {
  getPublicKey: vi.fn(),
  signTransaction: vi.fn(),
};

const mockLobstr = {
  getPublicKey: vi.fn(),
  signTransaction: vi.fn(),
};

const mockWindow = {
  freighter: mockFreighter,
  lobstr: mockLobstr,
};

describe('wallet library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'freighter', {
      value: mockFreighter,
      writable: true,
    });
    Object.defineProperty(window, 'lobstr', {
      value: mockLobstr,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isWalletInstalled', () => {
    it('returns true when Freighter is installed', () => {
      expect(isWalletInstalled('freighter')).toBe(true);
    });

    it('returns true when Lobstr is installed', () => {
      expect(isWalletInstalled('lobstr')).toBe(true);
    });

    it('returns true for WalletConnect (protocol does not require installation)', () => {
      expect(isWalletInstalled('walletconnect')).toBe(true);
    });

    it('returns false when wallet is not installed', () => {
      delete (window as any).freighter;
      expect(isWalletInstalled('freighter')).toBe(false);
    });

    it('returns false when window is undefined', () => {
      const originalWindow = global.window;
      delete (global as any).window;
      
      expect(isWalletInstalled('freighter')).toBe(false);
      
      global.window = originalWindow;
    });
  });

  describe('getWalletInstallUrl', () => {
    it('returns correct URLs for supported wallets', () => {
      expect(getWalletInstallUrl('freighter')).toBe('https://freighter.app');
      expect(getWalletInstallUrl('lobstr')).toBe('https://lobstr.co');
      expect(getWalletInstallUrl('walletconnect')).toBeNull();
    });
  });

  describe('connectWallet', () => {
    const mockAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';

    it('connects to Freighter successfully', async () => {
      mockFreighter.getPublicKey.mockResolvedValue(mockAddress);

      const result = await connectWallet('freighter');

      expect(result).toBe(mockAddress);
      expect(mockFreighter.getPublicKey).toHaveBeenCalled();
    });

    it('connects to Lobstr successfully', async () => {
      mockLobstr.getPublicKey.mockResolvedValue(mockAddress);

      const result = await connectWallet('lobstr');

      expect(result).toBe(mockAddress);
      expect(mockLobstr.getPublicKey).toHaveBeenCalled();
    });

    it('throws error for WalletConnect (not implemented)', async () => {
      await expect(connectWallet('walletconnect')).rejects.toThrow(
        'WalletConnect integration is not yet implemented'
      );
    });

    it('throws error when wallet is not installed', async () => {
      delete (window as any).freighter;

      await expect(connectWallet('freighter')).rejects.toThrow('freighter wallet not found');
    });

    it('handles user rejection', async () => {
      mockFreighter.getPublicKey.mockRejectedValue(new Error('User rejected'));

      await expect(connectWallet('freighter')).rejects.toThrow('Connection rejected');
    });

    it('handles connection timeout', async () => {
      mockFreighter.getPublicKey.mockRejectedValue(new Error('Connection timeout'));

      await expect(connectWallet('freighter')).rejects.toThrow('Connection timeout');
    });

    it('throws error when no public key returned', async () => {
      mockFreighter.getPublicKey.mockResolvedValue(null);

      await expect(connectWallet('freighter')).rejects.toThrow(
        'No public key returned from Freighter'
      );
    });

    it('throws error when window is undefined', async () => {
      const originalWindow = global.window;
      delete (global as any).window;

      await expect(connectWallet('freighter')).rejects.toThrow('Window is not defined');

      global.window = originalWindow;
    });
  });

  describe('signTransaction', () => {
    const mockXdr = 'AAAAAgAAAAA...';
    const mockSignedXdr = 'AAAAAgAAAAB...';

    it('signs transaction with Freighter successfully', async () => {
      mockFreighter.signTransaction.mockResolvedValue(mockSignedXdr);

      const result = await signTransaction(mockXdr, 'freighter');

      expect(result).toBe(mockSignedXdr);
      expect(mockFreighter.signTransaction).toHaveBeenCalledWith(mockXdr);
    });

    it('signs transaction with Lobstr successfully', async () => {
      mockLobstr.signTransaction.mockResolvedValue(mockSignedXdr);

      const result = await signTransaction(mockXdr, 'lobstr');

      expect(result).toBe(mockSignedXdr);
      expect(mockLobstr.signTransaction).toHaveBeenCalledWith(mockXdr);
    });

    it('throws error for WalletConnect signing (not implemented)', async () => {
      await expect(signTransaction(mockXdr, 'walletconnect')).rejects.toThrow(
        'WalletConnect integration is not yet implemented'
      );
    });

    it('throws error when wallet is not installed', async () => {
      delete (window as any).freighter;

      await expect(signTransaction(mockXdr, 'freighter')).rejects.toThrow(
        'freighter wallet not found'
      );
    });

    it('handles user rejection', async () => {
      mockFreighter.signTransaction.mockRejectedValue(new Error('User denied'));

      await expect(signTransaction(mockXdr, 'freighter')).rejects.toThrow('Transaction rejected');
    });

    it('throws error when no signed transaction returned', async () => {
      mockFreighter.signTransaction.mockResolvedValue(null);

      await expect(signTransaction(mockXdr, 'freighter')).rejects.toThrow(
        'No signed transaction returned from Freighter'
      );
    });
  });

  describe('getConnectedAddress', () => {
    const mockAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';

    it('returns address when Freighter is connected', async () => {
      mockFreighter.getPublicKey.mockResolvedValue(mockAddress);

      const result = await getConnectedAddress('freighter');

      expect(result).toBe(mockAddress);
    });

    it('returns address when Lobstr is connected', async () => {
      mockLobstr.getPublicKey.mockResolvedValue(mockAddress);

      const result = await getConnectedAddress('lobstr');

      expect(result).toBe(mockAddress);
    });

    it('returns null when wallet is not installed', async () => {
      delete (window as any).freighter;

      const result = await getConnectedAddress('freighter');

      expect(result).toBeNull();
    });

    it('returns null when wallet is not connected', async () => {
      mockFreighter.getPublicKey.mockRejectedValue(new Error('Not connected'));

      const result = await getConnectedAddress('freighter');

      expect(result).toBeNull();
    });

    it('returns null for WalletConnect (not implemented)', async () => {
      const result = await getConnectedAddress('walletconnect');

      expect(result).toBeNull();
    });
  });

  describe('getAnyConnectedAddress', () => {
    const mockFreighterAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
    const mockLobstrAddress = 'GDNSSYBRR4FENHT5SWZ2IV5ZLJLFLJZW2L5YV4F2M3D6RZJZK2RJZJZ';

    it('returns first available connected wallet', async () => {
      mockFreighter.getPublicKey.mockResolvedValue(mockFreighterAddress);
      mockLobstr.getPublicKey.mockResolvedValue(mockLobstrAddress);

      const result = await getAnyConnectedAddress();

      expect(result).toEqual({
        address: mockFreighterAddress,
        walletType: 'freighter',
      });
    });

    it('returns Lobstr when Freighter is not connected', async () => {
      mockFreighter.getPublicKey.mockRejectedValue(new Error('Not connected'));
      mockLobstr.getPublicKey.mockResolvedValue(mockLobstrAddress);

      const result = await getAnyConnectedAddress();

      expect(result).toEqual({
        address: mockLobstrAddress,
        walletType: 'lobstr',
      });
    });

    it('returns null when no wallets are connected', async () => {
      mockFreighter.getPublicKey.mockRejectedValue(new Error('Not connected'));
      mockLobstr.getPublicKey.mockRejectedValue(new Error('Not connected'));

      const result = await getAnyConnectedAddress();

      expect(result).toBeNull();
    });
  });

  describe('isWalletConnected', () => {
    const mockAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';

    it('returns true when wallet is connected', async () => {
      mockFreighter.getPublicKey.mockResolvedValue(mockAddress);

      const result = await isWalletConnected('freighter');

      expect(result).toBe(true);
    });

    it('returns false when wallet is not connected', async () => {
      mockFreighter.getPublicKey.mockRejectedValue(new Error('Not connected'));

      const result = await isWalletConnected('freighter');

      expect(result).toBe(false);
    });

    it('returns false when wallet is not installed', async () => {
      delete (window as any).freighter;

      const result = await isWalletConnected('freighter');

      expect(result).toBe(false);
    });
  });

  describe('isAnyWalletConnected', () => {
    const mockAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';

    it('returns true when any wallet is connected', async () => {
      mockFreighter.getPublicKey.mockResolvedValue(mockAddress);

      const result = await isAnyWalletConnected();

      expect(result).toBe(true);
    });

    it('returns false when no wallets are connected', async () => {
      mockFreighter.getPublicKey.mockRejectedValue(new Error('Not connected'));
      mockLobstr.getPublicKey.mockRejectedValue(new Error('Not connected'));

      const result = await isAnyWalletConnected();

      expect(result).toBe(false);
    });
  });

  describe('legacy functions', () => {
    const mockAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
    const mockXdr = 'AAAAAgAAAAA...';
    const mockSignedXdr = 'AAAAAgAAAAB...';

    it('connectWalletLegacy calls connectWallet with freighter', async () => {
      mockFreighter.getPublicKey.mockResolvedValue(mockAddress);

      const result = await connectWalletLegacy();

      expect(result).toBe(mockAddress);
    });

    it('connectWalletLegacy returns null on error', async () => {
      mockFreighter.getPublicKey.mockRejectedValue(new Error('Error'));

      const result = await connectWalletLegacy();

      expect(result).toBeNull();
    });

    it('signTransactionLegacy calls signTransaction with freighter', async () => {
      mockFreighter.signTransaction.mockResolvedValue(mockSignedXdr);

      const result = await signTransactionLegacy(mockXdr);

      expect(result).toBe(mockSignedXdr);
    });

    it('getConnectedAddressLegacy calls getConnectedAddress with freighter', async () => {
      mockFreighter.getPublicKey.mockResolvedValue(mockAddress);

      const result = await getConnectedAddressLegacy();

      expect(result).toBe(mockAddress);
    });

    it('isWalletConnectedLegacy calls isWalletConnected with freighter', async () => {
      mockFreighter.getPublicKey.mockResolvedValue(mockAddress);

      const result = await isWalletConnectedLegacy();

      expect(result).toBe(true);
    });
  });
});
