import { beforeEach, describe, expect, it, vi } from 'vitest';

const getNetworkMock = vi.fn();
const signTransactionMock = vi.fn();

vi.mock('@stellar/freighter-api', () => ({
  getNetwork: (...args: unknown[]) => getNetworkMock(...args),
  signTransaction: (...args: unknown[]) => signTransactionMock(...args),
}));

import { assertNetwork, mapWalletError, signTransaction, WalletError } from './freighter';

const EXPECTED_PASSPHRASE = 'Test SDF Network ; September 2015';
const OTHER_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

describe('freighter network guard', () => {
  beforeEach(() => {
    getNetworkMock.mockReset();
    signTransactionMock.mockReset();
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

  // #2219: a rejection must stay a rejection. The `reject`/`denied`/`cancel`
  // branch has to run before the generic "Freighter missing" fallback, since
  // Freighter's own rejection message happens to also mention "Freighter".
  describe('mapWalletError', () => {
    it('maps a rejection message to USER_REJECTED and does not tell the user to install Freighter', () => {
      const err = mapWalletError(new Error('User rejected the request'));

      expect(err).toBeInstanceOf(WalletError);
      expect(err.code).toBe('USER_REJECTED');
      expect(err.message.toLowerCase()).not.toContain('install');
    });

    it('maps an empty Error message to SIGN_FAILED', () => {
      const err = mapWalletError(new Error(''));

      expect(err).toBeInstanceOf(WalletError);
      expect(err.code).toBe('SIGN_FAILED');
    });
  });
});
