import { beforeEach, describe, expect, it, vi } from 'vitest';

const getNetworkMock = vi.fn();
const signTransactionMock = vi.fn();
const isConnectedMock = vi.fn();
const requestAccessMock = vi.fn();

vi.mock('@stellar/freighter-api', () => ({
  getNetwork: (...args: unknown[]) => getNetworkMock(...args),
  signTransaction: (...args: unknown[]) => signTransactionMock(...args),
  isConnected: (...args: unknown[]) => isConnectedMock(...args),
  requestAccess: (...args: unknown[]) => requestAccessMock(...args),
}));

import { assertNetwork, connectFreighter, detectFreighter, signTransaction, WalletError } from './freighter';

const EXPECTED_PASSPHRASE = 'Test SDF Network ; September 2015';
const OTHER_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

describe('freighter network guard', () => {
  beforeEach(() => {
    getNetworkMock.mockReset();
    signTransactionMock.mockReset();
    isConnectedMock.mockReset();
    requestAccessMock.mockReset();
  });

  describe('detectFreighter / connectFreighter', () => {
    it('calls requestAccess when isConnected resolves false (extension installed, not yet approved)', async () => {
      // The extension object exists and responds, it just reports that this
      // site has not been granted access yet.
      isConnectedMock.mockResolvedValue({ isConnected: false });
      requestAccessMock.mockResolvedValue({ address: 'GABC...' });

      await expect(detectFreighter()).resolves.toBe(true);

      const address = await connectFreighter();
      expect(address).toBe('GABC...');
      expect(requestAccessMock).toHaveBeenCalledTimes(1);
    });

    it('treats a thrown/missing isConnected call as FREIGHTER_MISSING and never calls requestAccess', async () => {
      isConnectedMock.mockRejectedValue(new Error('freighterApi is not defined'));

      await expect(detectFreighter()).resolves.toBe(false);

      await expect(connectFreighter()).rejects.toMatchObject({
        code: 'FREIGHTER_MISSING',
      });
      expect(requestAccessMock).not.toHaveBeenCalled();
    });
  });

  describe('assertNetwork', () => {
    it('resolves when the active passphrase matches the expected passphrase', async () => {
      getNetworkMock.mockResolvedValue({ networkPassphrase: EXPECTED_PASSPHRASE });

      await expect(assertNetwork(EXPECTED_PASSPHRASE)).resolves.toBeUndefined();
      expect(getNetworkMock).toHaveBeenCalledTimes(1);
    });

    it('throws NETWORK_MISMATCH when the active passphrase is missing', async () => {
      getNetworkMock.mockResolvedValue({});

      await expect(assertNetwork(EXPECTED_PASSPHRASE)).rejects.toMatchObject({
        code: 'NETWORK_MISMATCH',
      });
      await expect(assertNetwork(EXPECTED_PASSPHRASE)).rejects.toBeInstanceOf(WalletError);
    });

    it('throws NETWORK_MISMATCH when the active passphrase differs', async () => {
      getNetworkMock.mockResolvedValue({ networkPassphrase: OTHER_PASSPHRASE });

      await expect(assertNetwork(EXPECTED_PASSPHRASE)).rejects.toMatchObject({
        code: 'NETWORK_MISMATCH',
      });
      await expect(assertNetwork(EXPECTED_PASSPHRASE)).rejects.toBeInstanceOf(WalletError);
    });
  });

  describe('signTransaction', () => {
    it('throws NETWORK_MISMATCH and does not call the Freighter signer on a mismatch', async () => {
      getNetworkMock.mockResolvedValue({ networkPassphrase: OTHER_PASSPHRASE });

      await expect(signTransaction('xdr', EXPECTED_PASSPHRASE)).rejects.toMatchObject({
        code: 'NETWORK_MISMATCH',
      });
      expect(signTransactionMock).not.toHaveBeenCalled();
    });

    it('throws NETWORK_MISMATCH and does not call the Freighter signer when the passphrase is missing', async () => {
      getNetworkMock.mockResolvedValue({});

      await expect(signTransaction('xdr', EXPECTED_PASSPHRASE)).rejects.toMatchObject({
        code: 'NETWORK_MISMATCH',
      });
      expect(signTransactionMock).not.toHaveBeenCalled();
    });
  });
});
