import { describe, expect, it } from 'vitest';
import { Networks } from '@stellar/stellar-sdk';
import { DEFAULT_NETWORK_PASSPHRASE, resolveNetworkPassphrase } from './stellar';

/**
 * Closes #2212: direct unit tests for the network guard in
 * `resolveNetworkPassphrase`. No wallet or transaction building is exercised
 * here — this only checks the passphrase allow-list behaviour.
 */
describe('resolveNetworkPassphrase', () => {
  it('throws for an unknown network passphrase', () => {
    expect(() => resolveNetworkPassphrase('not-a-network')).toThrow(
      /Unknown network passphrase/,
    );
  });

  it('returns the testnet passphrase when the argument is omitted', () => {
    expect(resolveNetworkPassphrase()).toBe(Networks.TESTNET);
    expect(resolveNetworkPassphrase()).toBe(DEFAULT_NETWORK_PASSPHRASE);
  });

  it('accepts the public passphrase', () => {
    expect(resolveNetworkPassphrase(Networks.PUBLIC)).toBe(Networks.PUBLIC);
  });

  it('accepts the futurenet passphrase', () => {
    expect(resolveNetworkPassphrase(Networks.FUTURENET)).toBe(Networks.FUTURENET);
  });
});
