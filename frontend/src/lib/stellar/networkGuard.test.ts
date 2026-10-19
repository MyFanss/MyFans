import { describe, expect, it } from 'vitest';

import { checkNetworkGuard, isNetworkMatch, normalizeNetwork } from './networkGuard';

const PUBLIC_PASSPHRASE = 'Public Global Stellar Network ; September 2015';
const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const FUTURENET_PASSPHRASE = 'Test SDF Future Network ; October 2022';

describe('normalizeNetwork', () => {
  it('normalizes exact enum values', () => {
    expect(normalizeNetwork('PUBLIC')).toBe('PUBLIC');
    expect(normalizeNetwork('TESTNET')).toBe('TESTNET');
    expect(normalizeNetwork('FUTURENET')).toBe('FUTURENET');
    expect(normalizeNetwork('STANDALONE')).toBe('STANDALONE');
  });

  it('is case-insensitive and trims whitespace for exact enum values', () => {
    expect(normalizeNetwork('  testnet ')).toBe('TESTNET');
    expect(normalizeNetwork('Public')).toBe('PUBLIC');
  });

  it('normalizes the canonical public, testnet, and futurenet passphrases', () => {
    expect(normalizeNetwork(PUBLIC_PASSPHRASE)).toBe('PUBLIC');
    expect(normalizeNetwork(TESTNET_PASSPHRASE)).toBe('TESTNET');
    expect(normalizeNetwork(FUTURENET_PASSPHRASE)).toBe('FUTURENET');
  });

  it('does not let a passphrase that merely contains "PUBLIC" shadow a more specific network', () => {
    // Regression for #2006: a standalone/custom passphrase that happens to
    // contain the substring "PUBLIC" must not be misclassified as PUBLIC.
    expect(normalizeNetwork('Standalone Network ; PUBLIC')).toBe('STANDALONE');
  });

  it('does not let a passphrase containing "PUBLIC" shadow TESTNET or FUTURENET', () => {
    expect(normalizeNetwork('Test SDF Network ; PUBLIC')).toBe('TESTNET');
    expect(normalizeNetwork('Test SDF Future Network ; PUBLIC')).toBe('FUTURENET');
  });

  it('returns null for an empty string', () => {
    expect(normalizeNetwork('')).toBeNull();
  });

  it('returns null for null and undefined', () => {
    expect(normalizeNetwork(null)).toBeNull();
    expect(normalizeNetwork(undefined)).toBeNull();
  });

  it('returns null for an unrecognized string', () => {
    expect(normalizeNetwork('some-other-network')).toBeNull();
  });
});

describe('checkNetworkGuard', () => {
  it('reports ok:true when the wallet network matches the expected network', () => {
    const result = checkNetworkGuard('TESTNET', TESTNET_PASSPHRASE);
    expect(result.ok).toBe(true);
    expect(result.expected).toBe('TESTNET');
    expect(result.actual).toBe('TESTNET');
  });

  it('reports ok:false with a reason when the networks differ', () => {
    const result = checkNetworkGuard('TESTNET', PUBLIC_PASSPHRASE);
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('reports ok:false for a standalone passphrase that contains "PUBLIC" when TESTNET is expected', () => {
    const result = checkNetworkGuard('TESTNET', 'Standalone Network ; PUBLIC');
    expect(result.ok).toBe(false);
    expect(result.actual).toBe('STANDALONE');
    expect(result.reason).toBeTruthy();
  });

  it('fails closed when the actual network cannot be determined', () => {
    const result = checkNetworkGuard('TESTNET', null);
    expect(result.ok).toBe(false);
    expect(result.actual).toBeNull();
  });

  it('fails closed when the expected network is unknown', () => {
    const result = checkNetworkGuard('not-a-network', TESTNET_PASSPHRASE);
    expect(result.ok).toBe(false);
  });
});

describe('isNetworkMatch', () => {
  it('returns true when the networks match', () => {
    expect(isNetworkMatch('PUBLIC', PUBLIC_PASSPHRASE)).toBe(true);
  });

  it('returns false when the networks differ', () => {
    expect(isNetworkMatch('PUBLIC', TESTNET_PASSPHRASE)).toBe(false);
  });

  it('returns false for the PUBLIC-substring regression case', () => {
    expect(isNetworkMatch('STANDALONE', 'Standalone Network ; PUBLIC')).toBe(true);
    expect(isNetworkMatch('PUBLIC', 'Standalone Network ; PUBLIC')).toBe(false);
  });
});
