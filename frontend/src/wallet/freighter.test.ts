import { beforeEach, describe, expect, it, vi } from 'vitest';

const getNetworkMock = vi.fn();
const signTransactionMock = vi.fn();

vi.mock('@stellar/freighter-api', () => ({
  getNetwork: (...args: unknown[]) => getNetworkMock(...args),
  signTransaction: (...args: unknown[]) => signTransactionMock(...args),
}));

import { assertNetwork, signTransaction, mapWalletError, WalletError } from './freighter';
// Pre-existing bug, unrelated to #2197: this file imported `WalletError` from
// a `./errors` module that does not exist in this package (it is defined in
// `./freighter` itself). Fixed here only because it blocks adding the new
// `mapWalletError` tests below to this file.

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

  describe('mapWalletError (#2197)', () => {
    it('maps a signing failure that merely mentions "Freighter" to SIGN_FAILED, keeping the original text', () => {
      const mapped = mapWalletError(new Error('Freighter signing failed'));
      expect(mapped.code).toBe('SIGN_FAILED');
      expect(mapped.message).toBe('Freighter signing failed');
    });

    it('maps "not installed" to FREIGHTER_MISSING', () => {
      const mapped = mapWalletError(new Error('Freighter is not installed'));
      expect(mapped.code).toBe('FREIGHTER_MISSING');
    });

    it('still maps a user rejection to USER_REJECTED', () => {
      const mapped = mapWalletError(new Error('User rejected the request'));
      expect(mapped.code).toBe('USER_REJECTED');
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
