import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertWalletNetworkMatches,
  isNetworkMismatch,
  normalizeExpectedNetwork,
} from './network-guard';

vi.mock('@/lib/contract-config', () => ({
  getRuntimeContractConfig: vi.fn(() => ({ network: 'testnet' })),
}));

import { getRuntimeContractConfig } from '@/lib/contract-config';

function setFreighter(getNetwork?: () => Promise<{ network: string; networkPassphrase: string }>) {
  (window as unknown as { freighter?: unknown }).freighter = getNetwork ? { getNetwork } : undefined;
}

describe('network-guard', () => {
  afterEach(() => {
    delete (window as unknown as { freighter?: unknown }).freighter;
    delete (window as unknown as { lobstr?: unknown }).lobstr;
    vi.mocked(getRuntimeContractConfig).mockReturnValue({ network: 'testnet' } as never);
  });

  describe('normalizeExpectedNetwork', () => {
    it('maps app network names to wallet names', () => {
      expect(normalizeExpectedNetwork('testnet')).toBe('TESTNET');
      expect(normalizeExpectedNetwork('mainnet')).toBe('PUBLIC');
      expect(normalizeExpectedNetwork('futurenet')).toBe('FUTURENET');
    });
  });

  describe('isNetworkMismatch', () => {
    it('is false when the wallet network is unknown', () => {
      expect(isNetworkMismatch(null, 'testnet')).toBe(false);
      expect(isNetworkMismatch(undefined, 'testnet')).toBe(false);
    });

    it('is false when networks match (case-insensitive)', () => {
      expect(isNetworkMismatch('testnet', 'testnet')).toBe(false);
      expect(isNetworkMismatch('TESTNET', 'testnet')).toBe(false);
    });

    it('is true when the wallet is on a different network', () => {
      expect(isNetworkMismatch('PUBLIC', 'testnet')).toBe(true);
    });
  });

  describe('assertWalletNetworkMatches', () => {
    it('resolves when no wallet is present', async () => {
      await expect(assertWalletNetworkMatches()).resolves.toBeUndefined();
    });

    it('resolves when the wallet is on the expected network', async () => {
      setFreighter(async () => ({ network: 'TESTNET', networkPassphrase: '' }));
      await expect(assertWalletNetworkMatches()).resolves.toBeUndefined();
    });

    it('resolves when the wallet network read throws (read-only sims still run)', async () => {
      setFreighter(async () => {
        throw new Error('locked');
      });
      await expect(assertWalletNetworkMatches()).resolves.toBeUndefined();
    });

    it('throws NETWORK_MISMATCH when the wallet is on the wrong network', async () => {
      setFreighter(async () => ({ network: 'PUBLIC', networkPassphrase: '' }));
      await expect(assertWalletNetworkMatches()).rejects.toMatchObject({
        code: 'NETWORK_MISMATCH',
      });
    });
  });
});
